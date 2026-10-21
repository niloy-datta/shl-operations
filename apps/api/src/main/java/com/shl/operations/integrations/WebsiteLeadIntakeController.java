package com.shl.operations.integrations;

import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Opt-in machine-to-machine intake. HMAC authenticates the raw request bytes;
 * staff session credentials are never accepted as substitutes.
 */
@RestController
@RequestMapping("/api/integrations/website")
public class WebsiteLeadIntakeController {
    private final JdbcTemplate db;
    private final JsonMapper json;
    private final Validator validator;
    private final String sharedSecret;

    public WebsiteLeadIntakeController(JdbcTemplate db, JsonMapper json, Validator validator,
        @Value("${SHL_WEBSITE_INTAKE_SECRET:}") String sharedSecret) {
        this.db = db;
        this.json = json;
        this.validator = validator;
        this.sharedSecret = sharedSecret;
    }

    public record Submission(
        @NotBlank @Pattern(regexp="^(contact|freight_quote)$") String source,
        @NotBlank @Pattern(regexp="^[A-Za-z0-9_-]{8,120}$") String externalSubmissionId,
        @Size(max=180) String companyName,
        @NotBlank @Size(max=120) String contactName,
        @NotBlank @Email @Size(max=240) String contactEmail,
        @NotBlank @Size(max=180) String subject,
        @Size(max=2000) String description
    ) {}

    private static String digest(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private boolean signatureValid(String timestamp, String supplied, byte[] payload) {
        if (timestamp == null || supplied == null || !timestamp.matches("[0-9]{10,12}")
            || !supplied.matches("sha256=[0-9a-fA-F]{64}")) return false;
        try {
            long seconds = Long.parseLong(timestamp), now = Instant.now().getEpochSecond();
            if (seconds < now - 300 || seconds > now + 300) return false;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(sharedSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            mac.update(timestamp.getBytes(StandardCharsets.US_ASCII));
            mac.update((byte)'\n');
            mac.update(payload);
            byte[] expected = mac.doFinal();
            byte[] provided = HexFormat.of().parseHex(supplied.substring(7));
            return MessageDigest.isEqual(expected, provided);
        } catch (Exception e) {
            return false;
        }
    }

    private static String clean(String value) {
        return value == null ? null : value.trim();
    }

    @PostMapping(value="/leads", consumes=MediaType.APPLICATION_JSON_VALUE)
    @Transactional
    public ResponseEntity<Map<String,Object>> receive(
        @RequestHeader("X-SHL-Timestamp") String timestamp,
        @RequestHeader("X-SHL-Signature") String signature,
        @RequestBody byte[] payload) {
        // Intentionally unavailable until approved secrets and ingress are provisioned.
        if (sharedSecret.length() < 32)
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Integration disabled");
        if (payload.length == 0 || payload.length > 8192)
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Invalid payload size");
        if (!signatureValid(timestamp, signature, payload))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid signed request");

        Submission input;
        try {
            input = json.readValue(payload, Submission.class);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid JSON");
        }
        if (input == null || !validator.validate(input).isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid lead fields");

        String payloadHash = digest(payload);
        String origin = input.source();
        String externalId = input.externalSubmissionId();
        db.update("""
            INSERT INTO website_lead_submissions(source,external_submission_id,payload_sha256)
            VALUES(?,?,?) ON CONFLICT (source,external_submission_id) DO NOTHING
            """, origin, externalId, payloadHash);
        var prior = db.queryForMap("""
            SELECT payload_sha256,lead_id FROM website_lead_submissions
            WHERE source=? AND external_submission_id=? FOR UPDATE
            """, origin, externalId);
        if (!payloadHash.equals(prior.get("payload_sha256")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Submission ID reused with different contents");
        if (prior.get("lead_id") != null)
            return ResponseEntity.ok(Map.of("leadId", prior.get("lead_id"),
                "duplicate", true));

        UUID leadId = UUID.randomUUID();
        String company = clean(input.companyName());
        if (company == null || company.isBlank())
            company = "[Individual] " + input.contactName().trim();
        String subject = clean(input.subject());
        db.update("""
            INSERT INTO crm_leads(id,reference,company_name,contact_name,contact_email,
                source,subject,description,created_by)
            VALUES(?,?,?,?,?,'WEBSITE',?,?,'website-intake')
            """, leadId, "LEAD-"+leadId.toString().substring(0,12).toUpperCase(),
            company, clean(input.contactName()), clean(input.contactEmail()),
            subject, clean(input.description()));
        db.update("""
            UPDATE website_lead_submissions SET lead_id=?
            WHERE source=? AND external_submission_id=?
            """, leadId, origin, externalId);
        // Deliberately omit names, email, message and quotation details from audit records.
        db.update("""
            INSERT INTO audit_events(id,actor,action,entity_type,entity_id,detail)
            VALUES(?,'website-intake','CREATED','LEAD',?,?)
            """, UUID.randomUUID(),leadId,"Website source: "+origin);
        return ResponseEntity.created(URI.create("/api/growth/leads/"+leadId))
            .body(Map.of("leadId", leadId, "duplicate", false));
    }
}
