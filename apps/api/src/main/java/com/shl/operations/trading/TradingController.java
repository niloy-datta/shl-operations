package com.shl.operations.trading;

import jakarta.validation.Valid;
import com.shl.operations.enterprise.AuditService;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/rfqs")
public class TradingController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public TradingController(JdbcTemplate db, AuditService audit) { this.db = db; this.audit=audit; }

    public record RfqInput(
        @NotNull UUID customerId,
        @NotBlank @Size(max = 180) String subject,
        @Size(max = 4000) String details,
        @NotNull @DecimalMin("0.001") BigDecimal quantity,
        @NotBlank @Size(max = 32) String unit,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
        LocalDate deadline
    ) {}
    public record OfferInput(
        @NotNull UUID supplierId,
        @NotNull @DecimalMin("0.0001") BigDecimal unitPrice,
        @NotNull @DecimalMin("0.001") BigDecimal moq,
        @NotNull @Min(1) @Max(3650) Integer leadDays,
        @Size(max = 2000) String notes
    ) {}
    public record StatusInput(@NotBlank String status) {}
    public record RfqRow(
        UUID id, String reference, UUID customerId, String customerName,
        String subject, String details, BigDecimal quantity, String unit, String currency,
        LocalDate deadline, String status, long offerCount, Instant createdAt
    ) {}
    public record RfqPage(List<RfqRow> content, long totalElements, int totalPages) {}
    public record OfferRow(UUID id, UUID supplierId, String supplierName,
        BigDecimal unitPrice, BigDecimal moq, int leadDays, String notes, Instant updatedAt) {}
    public record ActivityRow(String actor, String action, String detail, Instant createdAt) {}

    private static final String RFQ_SELECT = """
        SELECT r.id, r.reference, r.customer_id, c.name AS customer_name,
          r.subject, r.details, r.quantity, r.unit, r.currency, r.deadline, r.status,
          (SELECT count(*) FROM supplier_offers o WHERE o.rfq_id = r.id) AS offer_count,
          r.created_at
        FROM rfqs r JOIN customers c ON c.id = r.customer_id
        """;

    private RfqRow toRfq(java.sql.ResultSet rs, int ignored) throws java.sql.SQLException {
        return new RfqRow(
            rs.getObject("id", UUID.class), rs.getString("reference"),
            rs.getObject("customer_id", UUID.class), rs.getString("customer_name"),
            rs.getString("subject"), rs.getString("details"),
            rs.getBigDecimal("quantity"), rs.getString("unit"), rs.getString("currency").trim(),
            rs.getObject("deadline", LocalDate.class), rs.getString("status"),
            rs.getLong("offer_count"), rs.getTimestamp("created_at").toInstant()
        );
    }
    private String actor() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null ? "system" : authentication.getName();
    }
    private void activity(UUID rfqId, String action, String detail) {
        db.update("INSERT INTO rfq_activity(id,rfq_id,actor,action,detail) VALUES(?,?,?,?,?)",
            UUID.randomUUID(), rfqId, actor(), action, detail);
        audit.log(action,"RFQ",rfqId,detail);
    }
    private boolean exists(String table, UUID id) {
        // Table identifiers are fixed literals at call sites, never user input.
        return Boolean.TRUE.equals(db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM " + table + " WHERE id = ?)", Boolean.class, id));
    }
    private void requireRfq(UUID id) {
        if (!exists("rfqs", id)) throw new ResponseStatusException(NOT_FOUND, "RFQ not found");
    }
    @GetMapping
    public RfqPage list(@RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        int p = Math.max(0, page);
        int s = Math.min(100, Math.max(1, size));
        String search = "%" + q.trim().substring(0, Math.min(120, q.trim().length())).toLowerCase(Locale.ROOT) + "%";
        String where = " WHERE (lower(r.reference) LIKE ? OR lower(r.subject) LIKE ? OR lower(c.name) LIKE ?) ";
        Long total = db.queryForObject(
            "SELECT count(*) FROM rfqs r JOIN customers c ON c.id = r.customer_id" + where,
            Long.class, search, search, search);
        List<RfqRow> rows = db.query(
            RFQ_SELECT + where + " ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?",
            this::toRfq, search, search, search, s, (long)p * s);
        long count = total == null ? 0 : total;
        return new RfqPage(rows, count, (int)Math.ceil((double)count / s));
    }
    @GetMapping("/stats")
    public Map<String, Long> stats() {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("total", db.queryForObject("SELECT count(*) FROM rfqs", Long.class));
        for (String state : List.of("NEW", "SOURCING", "READY_FOR_QUOTE", "CLOSED")) counts.put(state, 0L);
        for (Map<String, Object> row : db.queryForList("SELECT status, count(*) AS total FROM rfqs GROUP BY status")) {
            counts.put((String) row.get("status"), ((Number) row.get("total")).longValue());
        }
        return counts;
    }
    @GetMapping("/{id}")
    public RfqRow get(@PathVariable UUID id) {
        return db.query(RFQ_SELECT + " WHERE r.id = ?", this::toRfq, id)
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "RFQ not found"));
    }
    @PostMapping
    @Transactional
    public ResponseEntity<RfqRow> create(@Valid @RequestBody RfqInput input) {
        if (!exists("customers", input.customerId()))
            throw new ResponseStatusException(BAD_REQUEST, "Select an existing customer");
        UUID id = UUID.randomUUID();
        String ref = "RFQ-" + id.toString().substring(0, 12).toUpperCase(Locale.ROOT);
        db.update("""
            INSERT INTO rfqs(id,reference,customer_id,subject,details,quantity,unit,currency,deadline)
            VALUES (?,?,?,?,?,?,?,?,?)
            """, id, ref, input.customerId(), input.subject().trim(),
            input.details() == null ? null : input.details().trim(),
            input.quantity(), input.unit().trim(), input.currency(), input.deadline());
        activity(id, "RFQ_CREATED", ref);
        return ResponseEntity.created(URI.create("/api/rfqs/" + id)).body(get(id));
    }
    @GetMapping("/{id}/offers")
    public List<OfferRow> offers(@PathVariable UUID id) {
        requireRfq(id);
        return db.query("""
            SELECT o.id, o.supplier_id, s.name AS supplier_name, o.unit_price, o.moq,
              o.lead_days, o.notes, o.updated_at
            FROM supplier_offers o JOIN suppliers s ON s.id = o.supplier_id
            WHERE o.rfq_id = ? ORDER BY o.unit_price, o.lead_days, s.name
            """, (rs, i) -> new OfferRow(rs.getObject("id", UUID.class),
              rs.getObject("supplier_id", UUID.class), rs.getString("supplier_name"),
              rs.getBigDecimal("unit_price"), rs.getBigDecimal("moq"),
              rs.getInt("lead_days"), rs.getString("notes"),
              rs.getTimestamp("updated_at").toInstant()), id);
    }
    @PostMapping("/{id}/offers")
    @Transactional
    public List<OfferRow> saveOffer(@PathVariable UUID id, @Valid @RequestBody OfferInput input) {
        String status = db.query("SELECT status FROM rfqs WHERE id = ? FOR UPDATE",
            (rs, row) -> rs.getString(1), id).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "RFQ not found"));
        if ("CLOSED".equals(status)) throw new ResponseStatusException(CONFLICT, "Closed RFQs cannot be modified");
        if (!exists("suppliers", input.supplierId()))
            throw new ResponseStatusException(BAD_REQUEST, "Select an existing supplier");
        db.update("""
            INSERT INTO supplier_offers(id,rfq_id,supplier_id,unit_price,moq,lead_days,notes)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT (rfq_id, supplier_id) DO UPDATE
            SET unit_price=excluded.unit_price, moq=excluded.moq,
                lead_days=excluded.lead_days, notes=excluded.notes, updated_at=now()
            """, UUID.randomUUID(), id, input.supplierId(), input.unitPrice(),
            input.moq(), input.leadDays(),
            input.notes() == null ? null : input.notes().trim());
        activity(id, "OFFER_SAVED", "Supplier " + input.supplierId());
        return offers(id);
    }
    @PatchMapping("/{id}/status")
    @Transactional
    public RfqRow changeStatus(@PathVariable UUID id, @Valid @RequestBody StatusInput input) {
        String current = db.query("SELECT status FROM rfqs WHERE id = ? FOR UPDATE",
            (rs, row) -> rs.getString(1), id).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "RFQ not found"));
        Map<String, String> next = Map.of(
            "NEW", "SOURCING", "SOURCING", "READY_FOR_QUOTE",
            "READY_FOR_QUOTE", "CLOSED");
        if (!Objects.equals(next.get(current), input.status()))
            throw new ResponseStatusException(CONFLICT, "Invalid workflow transition");
        if ("READY_FOR_QUOTE".equals(input.status())) {
            Long offerCount = db.queryForObject("SELECT count(*) FROM supplier_offers WHERE rfq_id = ?", Long.class, id);
            if (offerCount == null || offerCount == 0)
                throw new ResponseStatusException(CONFLICT, "Add a supplier offer before marking ready");
        }
        db.update("UPDATE rfqs SET status = ?, updated_at = now() WHERE id = ?", input.status(), id);
        activity(id, "STATUS_CHANGED", current + " -> " + input.status());
        return get(id);
    }
    @GetMapping("/{id}/history")
    public List<ActivityRow> history(@PathVariable UUID id) {
        requireRfq(id);
        return db.query("""
            SELECT actor, action, detail, created_at
            FROM rfq_activity WHERE rfq_id = ? ORDER BY created_at DESC LIMIT 100
            """, (rs, i) -> new ActivityRow(rs.getString("actor"), rs.getString("action"),
              rs.getString("detail"), rs.getTimestamp("created_at").toInstant()), id);
    }
}
