package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.net.URI;
import java.sql.Date;
import java.time.Instant;
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
@RequestMapping("/api/growth/leads/{leadId}/conversion")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
public class LeadConversionController
{
    private final JdbcTemplate db;
    private final AuditService audit;

    public LeadConversionController(JdbcTemplate db, AuditService audit)
    {
        this.db = db;
        this.audit = audit;
    }

    public record ConversionInput(
        @NotNull UUID customerId,
        @NotNull UUID ownerId,
        @NotNull @DecimalMin("0.001") @Digits(integer=15, fraction=3) BigDecimal quantity,
        @NotBlank @Size(max=32) String unit,
        @NotBlank @Pattern(regexp="[A-Z]{3}") String currency,
        LocalDate rfqDeadline,
        @NotBlank @Size(max=180) String projectTitle,
        @Size(max=2000) String projectDescription,
        LocalDate projectDueDate,
        @NotBlank @Size(max=300) String reviewReason)
    {
    }

    public record ConversionResult(
        UUID leadId,
        UUID customerId,
        UUID rfqId,
        UUID projectId,
        String reviewedBy,
        Instant createdAt)
    {
    }

    private Map<String,Object> lead(UUID id, boolean lock)
    {
        return db.queryForList("SELECT * FROM crm_leads WHERE id=?" +
            (lock ? " FOR UPDATE" : ""), id).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lead not found"));
    }

    private ConversionResult result(UUID id)
    {
        return db.query("""
            SELECT lead_id,customer_id,rfq_id,project_id,reviewed_by,created_at
            FROM crm_lead_conversions WHERE lead_id=?
            """, rs ->
        {
            if (!rs.next())
            {
                throw new ResponseStatusException(NOT_FOUND, "Conversion not found");
            }
            return new ConversionResult(
                rs.getObject("lead_id", UUID.class),
                rs.getObject("customer_id", UUID.class),
                rs.getObject("rfq_id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("reviewed_by"),
                rs.getTimestamp("created_at").toInstant());
        }, id);
    }

    private String clean(String text)
    {
        return text == null ? null : text.trim();
    }

    private boolean sameDate(Object existing, LocalDate requested)
    {
        if (requested == null)
        {
            return existing == null;
        }
        return Objects.equals(existing, Date.valueOf(requested));
    }

    private boolean sameRequest(Map<String,Object> existing, ConversionInput input)
    {
        return Objects.equals(existing.get("customer_id"), input.customerId())
            && Objects.equals(existing.get("owner_id"), input.ownerId())
            && ((BigDecimal) existing.get("quantity")).compareTo(input.quantity()) == 0
            && Objects.equals(existing.get("unit"), clean(input.unit()))
            && Objects.equals(existing.get("currency").toString().trim(), input.currency())
            && Objects.equals(existing.get("project_title"), clean(input.projectTitle()))
            && Objects.equals(existing.get("project_description"), clean(input.projectDescription()))
            && Objects.equals(existing.get("review_reason"), clean(input.reviewReason()))
            && sameDate(existing.get("rfq_deadline"), input.rfqDeadline())
            && sameDate(existing.get("project_due_date"), input.projectDueDate());
    }

    @GetMapping
    public ConversionResult get(@PathVariable UUID leadId)
    {
        lead(leadId, false);
        return result(leadId);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ConversionResult> convert(
        @PathVariable UUID leadId, @Valid @RequestBody ConversionInput input)
    {
        Map<String,Object> record = lead(leadId, true);
        List<Map<String,Object>> previous = db.queryForList(
            "SELECT * FROM crm_lead_conversions WHERE lead_id=?", leadId);
        if (!previous.isEmpty())
        {
            if (sameRequest(previous.getFirst(), input))
            {
                return ResponseEntity.ok(result(leadId));
            }
            throw new ResponseStatusException(CONFLICT,
                "Lead already converted with different approved details");
        }
        if (!"WON".equals(record.get("status")))
        {
            throw new ResponseStatusException(CONFLICT,
                "Only WON leads can be converted");
        }
        if (audit.actor().equals(record.get("created_by")))
        {
            throw new ResponseStatusException(CONFLICT,
                "A different authorized reviewer must approve conversion");
        }
        if (record.get("customer_id") != null &&
            !record.get("customer_id").equals(input.customerId()))
        {
            throw new ResponseStatusException(CONFLICT,
                "Lead is already linked to another customer");
        }
        Boolean customerExists = db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM customers WHERE id=?)",
            Boolean.class, input.customerId());
        if (!Boolean.TRUE.equals(customerExists))
        {
            throw new ResponseStatusException(BAD_REQUEST,
                "Select an existing reviewed customer");
        }
        Boolean ownerActive = db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM staff_users WHERE id=? AND enabled=true)",
            Boolean.class, input.ownerId());
        if (!Boolean.TRUE.equals(ownerActive))
        {
            throw new ResponseStatusException(BAD_REQUEST,
                "Select an active staff project owner");
        }
        if ((input.rfqDeadline() != null &&
             input.rfqDeadline().isBefore(LocalDate.now(ZoneOffset.UTC))) ||
            (input.projectDueDate() != null &&
             input.projectDueDate().isBefore(LocalDate.now(ZoneOffset.UTC))))
        {
            throw new ResponseStatusException(BAD_REQUEST, "Deadlines cannot be in the past");
        }

        UUID rfqId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        String rfqReference = "RFQ-" + rfqId.toString().substring(0,12).toUpperCase(Locale.ROOT);
        String projectReference = "JOB-" + projectId.toString().substring(0,12).toUpperCase(Locale.ROOT);

        db.update("""
            INSERT INTO rfqs
              (id,reference,customer_id,subject,details,quantity,unit,currency,deadline)
            VALUES (?,?,?,?,?,?,?,?,?)
            """, rfqId, rfqReference, input.customerId(), record.get("subject"),
            record.get("description"), input.quantity(), clean(input.unit()),
            input.currency(), input.rfqDeadline());
        db.update("""
            INSERT INTO rfq_activity (id,rfq_id,actor,action,detail)
            VALUES (?,?,?,?,?)
            """, UUID.randomUUID(), rfqId, audit.actor(),
            "RFQ_CREATED_FROM_LEAD", "Reviewed lead conversion " + leadId);

        db.update("""
            INSERT INTO business_projects
              (id,reference,customer_id,lead_id,title,description,owner_id,due_date,created_by)
            VALUES (?,?,?,?,?,?,?,?,?)
            """, projectId, projectReference, input.customerId(), leadId,
            clean(input.projectTitle()), clean(input.projectDescription()),
            input.ownerId(), input.projectDueDate(), audit.actor());

        db.update("UPDATE crm_leads SET customer_id=?,updated_at=now() WHERE id=?",
            input.customerId(), leadId);
        db.update("""
            INSERT INTO crm_lead_conversions
              (lead_id,customer_id,owner_id,rfq_id,project_id,quantity,unit,
               currency,rfq_deadline,project_title,project_description,
               project_due_date,review_reason,reviewed_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, leadId, input.customerId(), input.ownerId(), rfqId, projectId,
            input.quantity(), clean(input.unit()), input.currency(), input.rfqDeadline(),
            clean(input.projectTitle()), clean(input.projectDescription()),
            input.projectDueDate(), clean(input.reviewReason()), audit.actor());

        audit.log("LEAD_CONVERTED", "LEAD", leadId,
            "Reviewed conversion, RFQ " + rfqId + ", project " + projectId);
        audit.log("RFQ_CREATED", "RFQ", rfqId,
            "Source lead " + leadId);
        audit.log("CREATED", "PROJECT", projectId,
            "Source lead " + leadId);
        return ResponseEntity.created(
            URI.create("/api/growth/leads/" + leadId + "/conversion")).body(result(leadId));
    }
}
