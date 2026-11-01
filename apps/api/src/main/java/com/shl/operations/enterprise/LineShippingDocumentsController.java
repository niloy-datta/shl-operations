package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/**
 * Internal manual shipping-document checklist. Staff references are not proof of a
 * document, and this endpoint never accepts files, external links or verification claims.
 */
@RestController
@RequestMapping("/api/logistics/line-shipments/{shipmentId}/documents")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS','SOURCING')")
public class LineShippingDocumentsController {
    private final JdbcTemplate db;
    private final AuditService audit;
    private static final Map<String,String> KINDS=Map.of(
        "COMMERCIAL_INVOICE","Commercial invoice",
        "PACKING_LIST","Packing list",
        "TRANSPORT_DOCUMENT","Bill of lading / air waybill",
        "CERTIFICATE_OF_ORIGIN","Certificate of origin",
        "INSURANCE_CERTIFICATE","Insurance certificate");
    private static final List<String> ORDER=List.of(
        "COMMERCIAL_INVOICE","PACKING_LIST","TRANSPORT_DOCUMENT",
        "CERTIFICATE_OF_ORIGIN","INSURANCE_CERTIFICATE");
    private static final Set<String> STATUSES=Set.of("MISSING","REQUESTED","REPORTED_RECEIVED");
    public LineShippingDocumentsController(JdbcTemplate db,AuditService audit){
        this.db=db;this.audit=audit;
    }
    public record Item(String kind,String label,String status,String documentReference,
        String note,String updatedBy,OffsetDateTime updatedAt) {}
    public record Change(@NotBlank String status,
        @Size(max=120) String documentReference,@Size(max=300) String note) {}

    private String normalize(String value){
        return value==null||value.isBlank()?null:value.trim();
    }
    private String shipmentStatus(UUID shipmentId,boolean lock){
        String sql="SELECT status FROM line_shipments WHERE id=?"+(lock?" FOR UPDATE":"");
        return db.query(sql,(rs,i)->rs.getString("status"),shipmentId)
            .stream().findFirst().orElseThrow(
                ()->new ResponseStatusException(NOT_FOUND,"Shipment not found"));
    }

    @GetMapping
    public List<Item> list(@PathVariable UUID shipmentId){
        shipmentStatus(shipmentId,false);
        Map<String,Item> saved=new HashMap<>();
        db.query("""
            SELECT kind,status,document_reference,note,updated_by,updated_at
            FROM line_shipment_document_checklist WHERE shipment_id=?
            """,(rs,i)->new Item(rs.getString("kind"),KINDS.get(rs.getString("kind")),
                rs.getString("status"),rs.getString("document_reference"),
                rs.getString("note"),rs.getString("updated_by"),
                rs.getObject("updated_at",OffsetDateTime.class)),shipmentId)
            .forEach(item->saved.put(item.kind(),item));
        return ORDER.stream().map(kind->saved.getOrDefault(kind,
            new Item(kind,KINDS.get(kind),"MISSING",null,null,null,null))).toList();
    }

    @PatchMapping("/{kind}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS')")
    @Transactional
    public List<Item> change(@PathVariable UUID shipmentId,@PathVariable String kind,
        @Valid @RequestBody Change input){
        if(!KINDS.containsKey(kind))
            throw new ResponseStatusException(BAD_REQUEST,"Unknown document requirement");
        if(!STATUSES.contains(input.status()))
            throw new ResponseStatusException(BAD_REQUEST,"Invalid document status");
        String documentReference=normalize(input.documentReference());
        String note=normalize(input.note());
        if("REPORTED_RECEIVED".equals(input.status())&&documentReference==null)
            throw new ResponseStatusException(BAD_REQUEST,"Received items need an internal reference");
        if(!"REPORTED_RECEIVED".equals(input.status())&&documentReference!=null)
            throw new ResponseStatusException(BAD_REQUEST,"Only reported receipts can hold a reference");
        if("CANCELLED".equals(shipmentStatus(shipmentId,true)))
            throw new ResponseStatusException(CONFLICT,"Cancelled shipments cannot be updated");
        var previous=db.query("""
            SELECT status,document_reference,note FROM line_shipment_document_checklist
            WHERE shipment_id=? AND kind=?
            """,(rs,i)->Map.of("status",rs.getString("status"),
                "reference",Objects.toString(rs.getString("document_reference"),""),
                "note",Objects.toString(rs.getString("note"),"")),shipmentId,kind)
            .stream().findFirst().orElse(null);
        String before=previous==null?"MISSING":previous.get("status");
        if("REPORTED_RECEIVED".equals(before)&&"MISSING".equals(input.status())
            &&(note==null||note.length()<8))
            throw new ResponseStatusException(BAD_REQUEST,"Give a correction reason (8+ characters)");
        if(before.equals(input.status()) && previous!=null
            &&Objects.equals(previous.get("reference"),Objects.toString(documentReference,""))
            &&Objects.equals(previous.get("note"),Objects.toString(note,"")))
            throw new ResponseStatusException(CONFLICT,"No change to record");
        if(previous==null && "MISSING".equals(input.status()))
            throw new ResponseStatusException(CONFLICT,"Already marked missing");
        db.update("""
            INSERT INTO line_shipment_document_checklist
              (shipment_id,kind,status,document_reference,note,updated_by)
            VALUES (?,?,?,?,?,?)
            ON CONFLICT (shipment_id,kind) DO UPDATE SET
              status=EXCLUDED.status,document_reference=EXCLUDED.document_reference,
              note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now()
            """,shipmentId,kind,input.status(),documentReference,note,audit.actor());
        db.update("""
            INSERT INTO line_shipment_document_events
              (id,shipment_id,kind,old_status,new_status,document_reference,note,actor)
            VALUES (?,?,?,?,?,?,?,?)
            """,UUID.randomUUID(),shipmentId,kind,before,input.status(),
            documentReference,note,audit.actor());
        audit.log("DOCUMENT_STATUS_CHANGED","LINE_SHIPMENT",shipmentId,
            kind+": "+before+" -> "+input.status());
        return list(shipmentId);
    }
}
