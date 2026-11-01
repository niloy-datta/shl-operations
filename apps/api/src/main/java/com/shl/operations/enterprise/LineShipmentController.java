package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Evidence-based manual shipment milestones; no carrier tracking or invoices are implied. */
@RestController
@RequestMapping("/api/logistics/line-shipments")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS','SOURCING')")
public class LineShipmentController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public LineShipmentController(JdbcTemplate db,AuditService audit){
        this.db=db;this.audit=audit;
    }
    public record Booking(
        @NotNull UUID purchaseOrderId,
        @NotBlank @Size(max=160) String origin,
        @NotBlank @Size(max=160) String destination,
        @Size(max=160) String carrier,
        @Size(max=120) String trackingNumber,
        LocalDate etd,LocalDate eta) {}
    public record Status(@NotBlank String status,@Size(max=300) String notes) {}
    public record ShipmentDetails(Map<String,Object> shipment,
        List<Map<String,Object>> lines,List<Map<String,Object>> milestones) {}
    private Map<String,Object> one(String sql,Object...args){
        return db.queryForList(sql,args).stream().findFirst().orElseThrow(
            ()->new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private ResponseStatusException blocked(String reason){
        return new ResponseStatusException(CONFLICT,reason);
    }
    private String optional(String value){
        return value==null||value.isBlank()?null:value.trim();
    }
    private String ref(UUID id){
        return "LSH-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT);
    }

    @GetMapping
    public Pages.Result list(@RequestParam(required=false) UUID salesOrderId,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        String where=salesOrderId==null?"":" WHERE sh.sales_order_id=?";
        return Pages.of(db,"sh.*,po.reference AS po_reference,s.name AS supplier_name",
            "FROM line_shipments sh JOIN line_purchase_orders po ON po.id=sh.purchase_order_id "+
            "JOIN suppliers s ON s.id=po.supplier_id",where,
            salesOrderId==null?new Object[]{}:new Object[]{salesOrderId},
            "ORDER BY sh.created_at DESC,sh.id DESC",page,size);
    }
    @GetMapping("/{id}")
    public ShipmentDetails detail(@PathVariable UUID id){
        var sh=one("""
            SELECT sh.*,po.reference AS po_reference,s.name AS supplier_name
            FROM line_shipments sh
            JOIN line_purchase_orders po ON po.id=sh.purchase_order_id
            JOIN suppliers s ON s.id=po.supplier_id WHERE sh.id=?
            """,id);
        var lines=db.queryForList("""
            SELECT id,purchase_order_item_id,product_name,quantity,unit
            FROM line_shipment_items WHERE shipment_id=?
            ORDER BY product_name,id
            """,id);
        var milestones=db.queryForList("""
            SELECT id,event,notes,actor,occurred_at FROM line_shipment_events
            WHERE shipment_id=? ORDER BY occurred_at ASC,id ASC
            """,id);
        return new ShipmentDetails(sh,lines,milestones);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS')")
    @Transactional
    public ResponseEntity<ShipmentDetails> create(@Valid @RequestBody Booking input){
        if(input.etd()!=null && input.eta()!=null && input.eta().isBefore(input.etd()))
            throw new ResponseStatusException(BAD_REQUEST,"ETA cannot be before ETD");
        if(input.origin().trim().equalsIgnoreCase(input.destination().trim()))
            throw new ResponseStatusException(BAD_REQUEST,"Origin and destination must differ");
        Map<String,Object> original=one(
            "SELECT sales_order_id FROM line_purchase_orders WHERE id=?",input.purchaseOrderId());
        UUID orderId=(UUID)original.get("sales_order_id");
        Map<String,Object> order=one(
            "SELECT status FROM line_sales_orders WHERE id=? FOR UPDATE",orderId);
        Map<String,Object> po=one(
            "SELECT * FROM line_purchase_orders WHERE id=? FOR UPDATE",input.purchaseOrderId());
        if(!"CONFIRMED".equals(order.get("status")) || !"ISSUED".equals(po.get("status")))
            throw blocked("Only issued supplier POs on confirmed sales orders may be shipped");
        if(!db.queryForList("SELECT id FROM line_shipments WHERE purchase_order_id=?",
            input.purchaseOrderId()).isEmpty())
            throw blocked("PO already has its one full-allocation shipment");
        var items=db.queryForList("""
            SELECT id,product_name,quantity,unit FROM line_purchase_order_items
            WHERE purchase_order_id=? ORDER BY id
            """,input.purchaseOrderId());
        if(items.isEmpty())throw blocked("PO has no product allocations");
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO line_shipments
            (id,reference,sales_order_id,purchase_order_id,origin,destination,
             carrier,tracking_number,etd,eta,created_by)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)
            """,id,ref(id),orderId,input.purchaseOrderId(),input.origin().trim(),
            input.destination().trim(),optional(input.carrier()),optional(input.trackingNumber()),
            input.etd(),input.eta(),audit.actor());
        for(var item:items)db.update("""
            INSERT INTO line_shipment_items
            (id,shipment_id,purchase_order_item_id,product_name,quantity,unit)
            VALUES(?,?,?,?,?,?)
            """,UUID.randomUUID(),id,item.get("id"),item.get("product_name"),
            item.get("quantity"),item.get("unit"));
        recordEvent(id,"BOOKED","Manual booking created");
        audit.log("CREATED","LINE_SHIPMENT",id,"Linked to issued PO "+input.purchaseOrderId());
        return ResponseEntity.created(URI.create("/api/logistics/line-shipments/"+id)).body(detail(id));
    }

    private void recordEvent(UUID id,String event,String notes){
        db.update("""
            INSERT INTO line_shipment_events(id,shipment_id,event,notes,actor)
            VALUES(?,?,?,?,?)
            """,UUID.randomUUID(),id,event,notes,audit.actor());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS')")
    @Transactional
    public ShipmentDetails change(@PathVariable UUID id,@Valid @RequestBody Status input){
        Map<String,Object> sh=one(
            "SELECT * FROM line_shipments WHERE id=? FOR UPDATE",id);
        String before=(String)sh.get("status"),next=input.status();
        boolean allowed=("BOOKED".equals(before)&&Set.of("IN_TRANSIT","CANCELLED").contains(next))
            || ("IN_TRANSIT".equals(before)&&"DELIVERED".equals(next));
        if(!allowed)throw blocked("Unsupported or repeated shipment transition");
        LocalDate today=LocalDate.now(ZoneOffset.UTC);
        if("IN_TRANSIT".equals(next))db.update("""
            UPDATE line_shipments SET status=?,atd=?,updated_at=now() WHERE id=?
            """,next,today,id);
        else if("DELIVERED".equals(next))db.update("""
            UPDATE line_shipments SET status=?,ata=?,updated_at=now() WHERE id=?
            """,next,today,id);
        else db.update("""
            UPDATE line_shipments SET status=?,updated_at=now() WHERE id=?
            """,next,id);
        recordEvent(id,next,optional(input.notes()));
        audit.log("STATUS_CHANGED","LINE_SHIPMENT",id,before+" -> "+next);
        return detail(id);
    }
}
