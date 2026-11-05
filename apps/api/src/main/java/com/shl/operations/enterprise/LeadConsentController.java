package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.List;
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
@RequestMapping("/api/growth/leads/{leadId}/consents")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
public class LeadConsentController
{
    private static final Set<String> CHANNELS = Set.of("EMAIL", "PHONE", "WECHAT");
    private static final Set<String> PURPOSES = Set.of("FOLLOW_UP", "MARKETING");
    private static final Set<String> DECISIONS = Set.of("GRANTED", "REVOKED");

    private final JdbcTemplate db;
    private final AuditService audit;

    public LeadConsentController(JdbcTemplate db, AuditService audit)
    {
        this.db = db;
        this.audit = audit;
    }

    public record ConsentInput(
        @NotBlank String channel,
        @NotBlank String purpose,
        @NotBlank String decision,
        @NotBlank @Size(max = 500) String evidence)
    {
    }

    public record ConsentSnapshot(
        List<Map<String, Object>> current,
        List<Map<String, Object>> history)
    {
    }

    private String normalized(String value, Set<String> allowed, String field)
    {
        String result = value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(result))
        {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid " + field);
        }
        return result;
    }

    private void requireLead(UUID leadId, boolean lock)
    {
        String sql = "SELECT id FROM crm_leads WHERE id=?" + (lock ? " FOR UPDATE" : "");
        if (db.queryForList(sql, leadId).isEmpty())
        {
            throw new ResponseStatusException(NOT_FOUND, "Lead not found");
        }
    }

    @GetMapping
    public ConsentSnapshot list(@PathVariable UUID leadId)
    {
        requireLead(leadId, false);
        List<Map<String, Object>> current = db.queryForList("""
            SELECT DISTINCT ON (channel,purpose)
                id,channel,purpose,decision,evidence,actor,created_at
            FROM crm_lead_contact_consents
            WHERE lead_id=?
            ORDER BY channel,purpose,created_at DESC,id DESC
            """, leadId);
        List<Map<String, Object>> history = db.queryForList("""
            SELECT id,channel,purpose,decision,evidence,actor,created_at
            FROM crm_lead_contact_consents
            WHERE lead_id=?
            ORDER BY created_at DESC,id DESC LIMIT 100
            """, leadId);
        return new ConsentSnapshot(current, history);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> record(
        @PathVariable UUID leadId, @Valid @RequestBody ConsentInput input)
    {
        String channel = normalized(input.channel(), CHANNELS, "channel");
        String purpose = normalized(input.purpose(), PURPOSES, "purpose");
        String decision = normalized(input.decision(), DECISIONS, "decision");
        String evidence = input.evidence().trim();

        requireLead(leadId, true);
        String status = db.queryForObject(
            "SELECT status FROM crm_leads WHERE id=?", String.class, leadId);
        if ("GRANTED".equals(decision) && Set.of("WON", "LOST").contains(status))
        {
            throw new ResponseStatusException(CONFLICT, "Cannot record new opt-in on a closed lead");
        }
        List<String> previous = db.queryForList("""
            SELECT decision FROM crm_lead_contact_consents
            WHERE lead_id=? AND channel=? AND purpose=?
            ORDER BY created_at DESC,id DESC LIMIT 1
            """, String.class, leadId, channel, purpose);
        if (!previous.isEmpty() && previous.getFirst().equals(decision))
        {
            throw new ResponseStatusException(CONFLICT, "This preference is already recorded");
        }

        UUID id = UUID.randomUUID();
        db.update("""
            INSERT INTO crm_lead_contact_consents
                (id,lead_id,channel,purpose,decision,evidence,actor)
            VALUES (?,?,?,?,?,?,?)
            """, id, leadId, channel, purpose, decision, evidence, audit.actor());
        audit.log("CONTACT_PREFERENCE_RECORDED", "LEAD", leadId,
            channel + " / " + purpose + " / " + decision + " event " + id);

        Map<String, Object> result = db.queryForMap("""
            SELECT id,channel,purpose,decision,evidence,actor,created_at
            FROM crm_lead_contact_consents WHERE id=?
            """, id);
        return ResponseEntity.created(
            URI.create("/api/growth/leads/" + leadId + "/consents")).body(result);
    }
}
