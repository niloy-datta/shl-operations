package com.shl.operations.enterprise;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Read-only deterministic CRM triage; never an AI conversion probability. */
@RestController
@RequestMapping("/api/growth/leads")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
public class LeadQualificationController {
    private final JdbcTemplate db;
    public LeadQualificationController(JdbcTemplate db) { this.db = db; }

    public record QualificationResult(
        UUID leadId, Integer score, String band,
        List<String> signals, List<String> nextActions, String disclaimer) {}

    private static final String DISCLAIMER =
        "Rule-based internal triage only; not a conversion probability, customer rating, "
        + "commercial approval, or verified evidence.";

    @GetMapping("/{id}/qualification")
    public QualificationResult qualify(@PathVariable UUID id) {
        return db.query("""
            SELECT l.status,l.owner_id,l.contact_email,l.customer_id,l.next_follow_up,
                   EXISTS(SELECT 1 FROM crm_lead_activity a WHERE a.lead_id=l.id) AS has_activity
            FROM crm_leads l WHERE l.id=?
            """, rs -> {
            if (!rs.next()) throw new ResponseStatusException(NOT_FOUND, "Lead not found");
            String stage = rs.getString("status");
            if ("WON".equals(stage) || "LOST".equals(stage)) {
                return new QualificationResult(id, null, "CLOSED",
                    List.of("Lead stage is " + stage + "."), List.of(), DISCLAIMER);
            }
            int score = 0;
            List<String> signals = new ArrayList<>();
            List<String> nextActions = new ArrayList<>();
            if ("QUALIFIED".equals(stage)) {
                score += 45;
                signals.add("Lead has been manually qualified (+45).");
            } else if ("CONTACTED".equals(stage)) {
                score += 25;
                signals.add("Lead has been marked contacted (+25).");
                nextActions.add("Review qualification criteria with the owner.");
            } else {
                nextActions.add("Contact the prospect and record the outcome.");
            }
            if (rs.getObject("owner_id") != null) {
                score += 15;
                signals.add("A staff owner is assigned (+15).");
            } else {
                nextActions.add("Assign a responsible lead owner.");
            }
            String email = rs.getString("contact_email");
            if (email != null && !email.isBlank()) {
                score += 5;
                signals.add("A contact email is recorded (+5).");
            } else {
                nextActions.add("Record a usable contact channel.");
            }
            if (rs.getObject("customer_id") != null) {
                score += 15;
                signals.add("The lead is linked to a customer record (+15).");
            } else {
                nextActions.add("Link an approved customer record when appropriate.");
            }
            var followUpDate = rs.getDate("next_follow_up");
            LocalDate followUp = followUpDate == null ? null : followUpDate.toLocalDate();
            if (followUp != null && !followUp.isBefore(LocalDate.now(ZoneOffset.UTC))) {
                score += 10;
                signals.add("A non-overdue UTC follow-up is scheduled (+10).");
            } else if (followUp != null) {
                nextActions.add("Follow-up is overdue (UTC); review or reschedule.");
            } else {
                nextActions.add("Schedule the next follow-up.");
            }
            if (rs.getBoolean("has_activity")) {
                score += 10;
                signals.add("At least one internal activity is logged (+10).");
            } else {
                nextActions.add("Record a call, meeting, email or other internal activity.");
            }
            String band = score >= 75 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
            return new QualificationResult(id, score, band,
                List.copyOf(signals), List.copyOf(nextActions), DISCLAIMER);
        }, id);
    }
}
