package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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

@RestController
@RequestMapping("/api/logistics/line-shipments/{shipmentId}/exceptions")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS','SOURCING')")
public class LineShipmentExceptionsController
{
    private static final Set<String> TYPES = Set.of(
        "CUSTOMS_HOLD", "TRANSSHIPMENT", "DAMAGE", "DISPUTE");

    private final JdbcTemplate db;
    private final AuditService audit;

    public LineShipmentExceptionsController(JdbcTemplate db, AuditService audit)
    {
        this.db = db;
        this.audit = audit;
    }

    public record Open(
        @NotBlank String type,
        @NotBlank @Size(max=2000) String description,
        LocalDate reviewDue)
    {
    }

    public record Resolve(
        @NotBlank @Size(max=2000) String resolution)
    {
    }

    private Map<String,Object> shipment(UUID shipmentId, boolean lock)
    {
        return db.queryForList("SELECT id,status FROM line_shipments WHERE id=?" +
            (lock ? " FOR UPDATE" : ""), shipmentId)
            .stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Shipment not found"));
    }

    private Map<String,Object> caseRow(UUID shipmentId, UUID caseId, boolean lock)
    {
        return db.queryForList("""
            SELECT * FROM line_shipment_exceptions
            WHERE shipment_id=? AND id=?
            """ + (lock ? " FOR UPDATE" : ""), shipmentId, caseId)
            .stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Exception case not found"));
    }

    @GetMapping
    public List<Map<String,Object>> list(@PathVariable UUID shipmentId)
    {
        shipment(shipmentId, false);
        return db.queryForList("""
            SELECT id,shipment_id,type,status,description,review_due,
                   opened_by,created_at,reviewed_by,resolution,resolved_at
            FROM line_shipment_exceptions WHERE shipment_id=?
            ORDER BY (status='OPEN') DESC,created_at DESC,id DESC LIMIT 100
            """, shipmentId);
    }

    @GetMapping("/{caseId}/events")
    public List<Map<String,Object>> history(
        @PathVariable UUID shipmentId, @PathVariable UUID caseId)
    {
        caseRow(shipmentId, caseId, false);
        return db.queryForList("""
            SELECT id,event,notes,actor,created_at
            FROM line_shipment_exception_events
            WHERE case_id=? ORDER BY created_at ASC,id ASC LIMIT 100
            """, caseId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS')")
    @Transactional
    public ResponseEntity<Map<String,Object>> open(
        @PathVariable UUID shipmentId, @Valid @RequestBody Open input)
    {
        String type = input.type().trim().toUpperCase(Locale.ROOT);
        if (!TYPES.contains(type))
        {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported exception type");
        }
        if (input.reviewDue() != null &&
            input.reviewDue().isBefore(LocalDate.now(ZoneOffset.UTC)))
        {
            throw new ResponseStatusException(BAD_REQUEST, "Review date cannot be in the past");
        }
        var current = shipment(shipmentId, true);
        String status = (String) current.get("status");
        if ("CANCELLED".equals(status) ||
            ("DELIVERED".equals(status) && Set.of("CUSTOMS_HOLD", "TRANSSHIPMENT").contains(type)))
        {
            throw new ResponseStatusException(CONFLICT,
                "Exception type is not valid at this shipment stage");
        }
        UUID caseId = UUID.randomUUID();
        db.update("""
            INSERT INTO line_shipment_exceptions
                (id,shipment_id,type,description,review_due,opened_by)
            VALUES (?,?,?,?,?,?)
            """, caseId,shipmentId,type,input.description().trim(),
            input.reviewDue(),audit.actor());
        db.update("""
            INSERT INTO line_shipment_exception_events
                (id,case_id,event,notes,actor)
            VALUES (?,?,?,?,?)
            """,UUID.randomUUID(),caseId,"OPENED",input.description().trim(),audit.actor());
        audit.log("EXCEPTION_OPENED", "LINE_SHIPMENT", shipmentId, type+" case "+caseId);
        return ResponseEntity.created(URI.create(
            "/api/logistics/line-shipments/"+shipmentId+"/exceptions/"+caseId))
            .body(caseRow(shipmentId,caseId,false));
    }

    @PatchMapping("/{caseId}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public Map<String,Object> resolve(@PathVariable UUID shipmentId,
        @PathVariable UUID caseId, @Valid @RequestBody Resolve input)
    {
        shipment(shipmentId, true);
        var current = caseRow(shipmentId,caseId,true);
        if (!"OPEN".equals(current.get("status")))
        {
            throw new ResponseStatusException(CONFLICT, "Case is already resolved");
        }
        if (audit.actor().equals(current.get("opened_by")))
        {
            throw new ResponseStatusException(CONFLICT,
                "An independent reviewer must resolve this exception");
        }
        db.update("""
            UPDATE line_shipment_exceptions
            SET status='RESOLVED',resolution=?,reviewed_by=?,resolved_at=clock_timestamp()
            WHERE id=?
            """,input.resolution().trim(),audit.actor(),caseId);
        db.update("""
            INSERT INTO line_shipment_exception_events
                (id,case_id,event,notes,actor)
            VALUES (?,?,?,?,?)
            """,UUID.randomUUID(),caseId,"RESOLVED",input.resolution().trim(),audit.actor());
        audit.log("EXCEPTION_RESOLVED","LINE_SHIPMENT",shipmentId,"Case "+caseId);
        return caseRow(shipmentId,caseId,false);
    }
}
