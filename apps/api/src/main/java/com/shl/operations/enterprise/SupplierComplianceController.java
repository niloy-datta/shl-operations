package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/supplier-compliance/suppliers/{supplierId}")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING','BD')")
public class SupplierComplianceController
{
    private static final Set<String> KINDS = Set.of(
        "TRADE_LICENSE", "TAX_CERTIFICATE", "EXPORT_LICENSE",
        "QUALITY_CERTIFICATE", "INSURANCE", "OTHER");
    private static final Set<String> DECISIONS = Set.of("APPROVED", "REJECTED");
    private final JdbcTemplate db;
    private final AuditService audit;

    public SupplierComplianceController(JdbcTemplate db, AuditService audit)
    {
        this.db = db;
        this.audit = audit;
    }

    public record EvidenceInput(
        @NotBlank String kind,
        @NotBlank @Size(max=180) String documentReference,
        LocalDate issuedOn,
        LocalDate expiresOn,
        @Size(max=500) String notes)
    {
    }

    public record ReviewInput(
        @NotBlank String decision,
        @NotBlank @Size(max=500) String reviewReason)
    {
    }

    private String normalize(String value, Set<String> options, String field)
    {
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!options.contains(normalized))
        {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid " + field);
        }
        return normalized;
    }

    private void supplier(UUID supplierId, boolean lock)
    {
        String sql = "SELECT id FROM suppliers WHERE id=?" + (lock ? " FOR UPDATE" : "");
        if (db.queryForList(sql, supplierId).isEmpty())
        {
            throw new ResponseStatusException(NOT_FOUND, "Supplier not found");
        }
    }

    private Map<String,Object> evidence(UUID supplierId, UUID evidenceId, boolean lock)
    {
        return db.queryForList("""
            SELECT * FROM supplier_compliance_evidence
            WHERE supplier_id=? AND id=?
            """ + (lock ? " FOR UPDATE" : ""), supplierId, evidenceId)
            .stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Evidence not found"));
    }

    @GetMapping("/evidence")
    public Pages.Result list(@PathVariable UUID supplierId,
        @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size)
    {
        supplier(supplierId, false);
        return Pages.of(db, """
            e.id,e.supplier_id,e.kind,e.document_reference,e.issued_on,
            e.expires_on,e.notes,e.submitted_by,e.created_at,
            r.decision,r.review_reason,r.reviewed_by,r.reviewed_at,
            CASE
              WHEN r.decision='APPROVED' AND e.expires_on IS NOT NULL
                   AND e.expires_on < (now() AT TIME ZONE 'UTC')::date
                THEN 'EXPIRED'
              ELSE COALESCE(r.decision,'PENDING')
            END AS effective_status
            """, """
            FROM supplier_compliance_evidence e
            LEFT JOIN supplier_compliance_reviews r ON r.evidence_id=e.id
            """, " WHERE e.supplier_id=?", new Object[]{supplierId},
            "ORDER BY e.created_at DESC,e.id DESC", page, size);
    }

    @PostMapping("/evidence")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    @Transactional
    public ResponseEntity<Map<String,Object>> submit(@PathVariable UUID supplierId,
        @Valid @RequestBody EvidenceInput input)
    {
        String kind = normalize(input.kind(), KINDS, "document type");
        if (input.issuedOn() != null && input.expiresOn() != null &&
            input.expiresOn().isBefore(input.issuedOn()))
        {
            throw new ResponseStatusException(BAD_REQUEST,
                "Expiry cannot precede document issue date");
        }
        supplier(supplierId, true);
        UUID id = UUID.randomUUID();
        db.update("""
            INSERT INTO supplier_compliance_evidence
                (id,supplier_id,kind,document_reference,issued_on,expires_on,notes,submitted_by)
            VALUES (?,?,?,?,?,?,?,?)
            """, id,supplierId,kind,input.documentReference().trim(),input.issuedOn(),
            input.expiresOn(),input.notes()==null?null:input.notes().trim(),audit.actor());
        audit.log("EVIDENCE_SUBMITTED","SUPPLIER",supplierId,
            "Reference only, pending verification: "+kind+" event "+id);
        return ResponseEntity.created(URI.create(
            "/api/supplier-compliance/suppliers/"+supplierId+"/evidence"))
            .body(evidence(supplierId,id,false));
    }

    @PostMapping("/evidence/{evidenceId}/review")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public Map<String,Object> review(@PathVariable UUID supplierId,
        @PathVariable UUID evidenceId,@Valid @RequestBody ReviewInput input)
    {
        String decision = normalize(input.decision(), DECISIONS, "decision");
        supplier(supplierId, true);
        Map<String,Object> original = evidence(supplierId,evidenceId,true);
        if (audit.actor().equals(original.get("submitted_by")))
        {
            throw new ResponseStatusException(CONFLICT,
                "Independent reviewer required");
        }
        if ("APPROVED".equals(decision) && original.get("expires_on") != null)
        {
            LocalDate expiry = ((java.sql.Date)original.get("expires_on")).toLocalDate();
            if (expiry.isBefore(LocalDate.now(ZoneOffset.UTC)))
            {
                throw new ResponseStatusException(CONFLICT,
                    "Expired reference cannot be approved");
            }
        }
        if (!db.queryForList(
            "SELECT evidence_id FROM supplier_compliance_reviews WHERE evidence_id=?",
            evidenceId).isEmpty())
        {
            throw new ResponseStatusException(CONFLICT,
                "Reference already reviewed; submit a new evidence version");
        }
        db.update("""
            INSERT INTO supplier_compliance_reviews
                (id,evidence_id,decision,review_reason,reviewed_by)
            VALUES (?,?,?,?,?)
            """,UUID.randomUUID(),evidenceId,decision,
            input.reviewReason().trim(),audit.actor());
        audit.log("EVIDENCE_REVIEWED","SUPPLIER",supplierId,
            original.get("kind")+" "+decision+" event "+evidenceId);
        return db.queryForMap("""
            SELECT e.id,e.supplier_id,e.kind,e.document_reference,e.expires_on,
                   r.decision,r.review_reason,r.reviewed_by,r.reviewed_at
            FROM supplier_compliance_evidence e
            JOIN supplier_compliance_reviews r ON r.evidence_id=e.id
            WHERE e.id=?
            """,evidenceId);
    }
}
