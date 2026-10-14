package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/logistics")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS','SOURCING')")
public class LogisticsController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public LogisticsController(JdbcTemplate db, AuditService audit) { this.db=db; this.audit=audit; }
    public record ShipmentInput(
        @NotNull UUID salesOrderId, UUID purchaseOrderId,
        @NotBlank @Size(max=160) String origin,
        @NotBlank @Size(max=160) String destination,
        @Size(max=160) String carrier, @Size(max=120) String trackingNumber,
        LocalDate etd, LocalDate eta) {}
    public record StatusInput(@NotBlank String status, @Size(max=300) String notes) {}
    public record ConsigneeAssignment(@NotNull UUID consigneeId) {}
    private Map<String,Object> row(String sql,Object... values) {
        return db.queryForList(sql,values).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private void require(boolean ok,String message) {
        if (!ok) throw new ResponseStatusException(CONFLICT,message);
    }
    @GetMapping("/shipments")
    public Pages.Result list(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        String term=q==null?"":q.trim().toLowerCase(Locale.ROOT);
        term=term.substring(0,Math.min(100,term.length()));
        return Pages.of(db,"sh.*,so.reference AS sales_reference,so.customer_id AS customer_id,c.code AS consignee_code,c.company_name AS consignee_name",
            "FROM shipments sh JOIN sales_orders so ON so.id=sh.sales_order_id LEFT JOIN consignees c ON c.id=sh.consignee_id",
            " WHERE lower(sh.reference) LIKE ? OR lower(sh.destination) LIKE ? OR lower(coalesce(c.company_name,'')) LIKE ?",
            new Object[] {"%"+term+"%","%"+term+"%","%"+term+"%"},
            "ORDER BY sh.created_at DESC,sh.id DESC",page,size);
    }
    @GetMapping("/shipments/{id}")
    public Map<String,Object> get(@PathVariable UUID id) {
        return row("SELECT sh.*,c.code AS consignee_code,c.company_name AS consignee_name FROM shipments sh LEFT JOIN consignees c ON c.id=sh.consignee_id WHERE sh.id=?",id);
    }
    @PostMapping("/shipments")
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody ShipmentInput input) {
        var order=row("SELECT * FROM sales_orders WHERE id=? FOR UPDATE",input.salesOrderId());
        require(List.of("CONFIRMED","IN_PROGRESS").contains(order.get("status")),
            "Confirm the sales order first");
        if (input.purchaseOrderId()!=null) {
            var po=row("SELECT * FROM purchase_orders WHERE id=?",input.purchaseOrderId());
            require(po.get("sales_order_id").equals(input.salesOrderId()),
                "Purchase order does not match sales order");
            require(List.of("ISSUED","RECEIVED").contains(po.get("status")),
                "Linked purchase order must be issued before shipping");
        }
        if (input.etd()!=null && input.eta()!=null)
            require(!input.eta().isBefore(input.etd()),"ETA cannot precede ETD");
        UUID id=UUID.randomUUID();
        String ref="SHP-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT);
        db.update("""
            INSERT INTO shipments(id,reference,sales_order_id,purchase_order_id,origin,destination,
                carrier,tracking_number,etd,eta)
            VALUES(?,?,?,?,?,?,?,?,?,?)
            """,id,ref,input.salesOrderId(),input.purchaseOrderId(),
            input.origin().trim(),input.destination().trim(),
            input.carrier(),input.trackingNumber(),input.etd(),input.eta());
        milestone(id,"BOOKED","Shipment booked");
        audit.log("CREATED","SHIPMENT",id,"Sales order "+input.salesOrderId());
        return ResponseEntity.created(URI.create("/api/logistics/shipments/"+id)).body(get(id));
    }
    @PatchMapping("/shipments/{id}/consignee")
    @Transactional
    public Map<String,Object> assignConsignee(@PathVariable UUID id,
        @Valid @RequestBody ConsigneeAssignment input) {
        var shipment=row("SELECT * FROM shipments WHERE id=? FOR UPDATE",id);
        require("BOOKED".equals(shipment.get("status")),
            "Consignee can only be assigned before shipment departure");
        var consignee=row("SELECT id,code,customer_id,active FROM consignees WHERE id=?",
            input.consigneeId());
        require(Boolean.TRUE.equals(consignee.get("active")),"Consignee must be active");
        UUID customerId=db.queryForObject("SELECT customer_id FROM sales_orders WHERE id=?",
            UUID.class,shipment.get("sales_order_id"));
        require(customerId != null && customerId.equals(consignee.get("customer_id")),
            "Consignee belongs to a different customer");
        db.update("UPDATE shipments SET consignee_id=?,updated_at=now() WHERE id=?",
            input.consigneeId(),id);
        milestone(id,"CONSIGNEE_SET","Assigned consignee "+consignee.get("code"));
        audit.log("CONSIGNEE_ASSIGNED","SHIPMENT",id,
            "Consignee reference "+consignee.get("code"));
        return get(id);
    }
    private void milestone(UUID id,String event,String notes) {
        db.update("""
            INSERT INTO shipment_milestones(id,shipment_id,event,notes,actor) VALUES(?,?,?,?,?)
            """,UUID.randomUUID(),id,event,notes,audit.actor());
    }
    @PatchMapping("/shipments/{id}/status")
    @Transactional
    public Map<String,Object> change(@PathVariable UUID id,@Valid @RequestBody StatusInput input) {
        var shipment=row("SELECT * FROM shipments WHERE id=? FOR UPDATE",id);
        String before=(String)shipment.get("status"),next=input.status();
        require(("BOOKED".equals(before) && List.of("IN_TRANSIT","CANCELLED").contains(next))
            || ("IN_TRANSIT".equals(before) && "DELIVERED".equals(next)),
            "Invalid shipment transition");
        if ("IN_TRANSIT".equals(next))
            db.update("UPDATE shipments SET status=?,atd=coalesce(atd,current_date),updated_at=now() WHERE id=?",next,id);
        else if ("DELIVERED".equals(next))
            db.update("UPDATE shipments SET status=?,ata=coalesce(ata,current_date),updated_at=now() WHERE id=?",next,id);
        else db.update("UPDATE shipments SET status=?,updated_at=now() WHERE id=?",next,id);
        milestone(id,next,input.notes());
        audit.log("STATUS_CHANGED","SHIPMENT",id,before+" -> "+next);
        return get(id);
    }
    @GetMapping("/shipments/{id}/milestones")
    public List<Map<String,Object>> milestones(@PathVariable UUID id) {
        get(id);
        return db.queryForList("""
            SELECT event,notes,actor,occurred_at FROM shipment_milestones
            WHERE shipment_id=? ORDER BY occurred_at DESC,id DESC LIMIT 200
            """,id);
    }
}
