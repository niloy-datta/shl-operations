package com.shl.operations.trading;

import com.shl.operations.enterprise.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Append-only supplier pricing tied to a specific RFQ requirement line. */
@RestController
@RequestMapping("/api/rfqs/{rfqId}/line-offers")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
public class RfqLineOffersController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public RfqLineOffersController(JdbcTemplate db, AuditService audit) {
        this.db=db;this.audit=audit;
    }

    public record NewRevision(
        @NotNull UUID itemId,
        @NotNull UUID supplierId,
        @NotNull @DecimalMin("0.0001") @Digits(integer=14, fraction=4) BigDecimal unitPrice,
        @NotNull @DecimalMin("0.001") @Digits(integer=15, fraction=3) BigDecimal moq,
        @NotNull @Min(1) @Max(3650) Integer leadDays,
        @Pattern(regexp="EXW|FCA|FOB|CFR|CIF|DAP|DDP") String incoterm,
        @Size(max=160) String port,
        @Size(max=2000) String notes
    ) {}

    public record PriceRow(UUID id, UUID rfqId, UUID itemId, int lineNumber,
        String productName, String unit, BigDecimal requestedQuantity,
        UUID supplierId, String supplierName, int revisionNumber,
        BigDecimal unitPrice, BigDecimal moq, int leadDays,
        String incoterm, String port, String notes, String createdBy, Instant createdAt) {}

    private static String optional(String value) {
        return value==null || value.isBlank() ? null : value.trim();
    }

    private String actor() {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if (auth==null || auth.getName()==null) return "system";
        return auth.getName();
    }

    private static final String SELECT = """
        SELECT p.id,p.rfq_id,p.item_id,i.line_number,i.product_name,i.unit,
          i.quantity AS requested_quantity,p.supplier_id,s.name AS supplier_name,
          p.revision_number,p.unit_price,p.moq,p.lead_days,p.incoterm,p.port,
          p.notes,p.created_by,p.created_at
        FROM rfq_line_offer_revisions p
        JOIN rfq_line_items i ON i.id=p.item_id AND i.rfq_id=p.rfq_id
        JOIN suppliers s ON s.id=p.supplier_id
        """;

    private static PriceRow map(java.sql.ResultSet rs,int ignored) throws java.sql.SQLException {
        return new PriceRow(rs.getObject("id",UUID.class),rs.getObject("rfq_id",UUID.class),
            rs.getObject("item_id",UUID.class),rs.getInt("line_number"),
            rs.getString("product_name"),rs.getString("unit"),
            rs.getBigDecimal("requested_quantity"),rs.getObject("supplier_id",UUID.class),
            rs.getString("supplier_name"),rs.getInt("revision_number"),
            rs.getBigDecimal("unit_price"),rs.getBigDecimal("moq"),
            rs.getInt("lead_days"),rs.getString("incoterm"),rs.getString("port"),
            rs.getString("notes"),rs.getString("created_by"),
            rs.getTimestamp("created_at").toInstant());
    }

    private void requireRfq(UUID id) {
        Long count=db.queryForObject("SELECT count(*) FROM rfqs WHERE id=?",Long.class,id);
        if (count==null || count==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"RFQ not found");
    }

    @GetMapping
    public List<PriceRow> latest(@PathVariable UUID rfqId) {
        requireRfq(rfqId);
        return db.query("""
            SELECT current_quotes.* FROM (
              SELECT DISTINCT ON (p.item_id,p.supplier_id)
                p.id,p.rfq_id,p.item_id,i.line_number,i.product_name,i.unit,
                i.quantity AS requested_quantity,p.supplier_id,
                s.name AS supplier_name,p.revision_number,p.unit_price,
                p.moq,p.lead_days,p.incoterm,p.port,p.notes,
                p.created_by,p.created_at
              FROM rfq_line_offer_revisions p
              JOIN rfq_line_items i ON i.id=p.item_id AND i.rfq_id=p.rfq_id
              JOIN suppliers s ON s.id=p.supplier_id
              WHERE p.rfq_id=?
              ORDER BY p.item_id,p.supplier_id,p.revision_number DESC
            ) current_quotes
            ORDER BY line_number,unit_price,supplier_name
            LIMIT 2000
            """,RfqLineOffersController::map,rfqId);
    }

    @GetMapping("/{itemId}/history")
    public List<PriceRow> history(@PathVariable UUID rfqId,@PathVariable UUID itemId) {
        requireRfq(rfqId);
        Integer count=db.queryForObject("""
            SELECT count(*) FROM rfq_line_items WHERE rfq_id=? AND id=?
            """,Integer.class,rfqId,itemId);
        if (count==null || count==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Requirement line not found");
        return db.query(SELECT+"""
            WHERE p.rfq_id=? AND p.item_id=?
            ORDER BY p.created_at DESC,p.revision_number DESC,p.id DESC LIMIT 300
            """,RfqLineOffersController::map,rfqId,itemId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PriceRow add(@PathVariable UUID rfqId,@Valid @RequestBody NewRevision input) {
        // Serialize revisions with all RFQ item edits and stage transitions.
        String status=db.query("SELECT status FROM rfqs WHERE id=? FOR UPDATE",
            (rs,i)->rs.getString(1),rfqId).stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"RFQ not found"));
        if (!"SOURCING".equals(status))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Supplier quote revisions can only be submitted during sourcing");
        Long lockedQuotes=db.queryForObject("""
            SELECT count(*) FROM customer_line_quotes
            WHERE rfq_id=? AND status IN ('SUBMITTED','APPROVED')
            """,Long.class,rfqId);
        if(lockedQuotes!=null && lockedQuotes>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Customer quotation under review; supplier price changes are frozen");
        Long legacy=db.queryForObject(
            "SELECT count(*) FROM supplier_offers WHERE rfq_id=?",Long.class,rfqId);
        if (legacy!=null && legacy>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Existing RFQ uses the legacy aggregate pricing model");
        Long itemExists=db.queryForObject("""
            SELECT count(*) FROM rfq_line_items WHERE id=? AND rfq_id=?
            """,Long.class,input.itemId(),rfqId);
        if (itemExists==null || itemExists==0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Select a requirement belonging to this RFQ");
        Long supplierExists=db.queryForObject(
            "SELECT count(*) FROM suppliers WHERE id=?",Long.class,input.supplierId());
        if (supplierExists==null || supplierExists==0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Supplier not found");
        Integer revision=db.queryForObject("""
            SELECT COALESCE(MAX(revision_number),0)+1
            FROM rfq_line_offer_revisions WHERE item_id=? AND supplier_id=?
            """,Integer.class,input.itemId(),input.supplierId());
        if (revision==null || revision>10000)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Revision limit reached");
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO rfq_line_offer_revisions
            (id,rfq_id,item_id,supplier_id,revision_number,unit_price,moq,lead_days,
             incoterm,port,notes,created_by)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """,id,rfqId,input.itemId(),input.supplierId(),revision,
            input.unitPrice(),input.moq(),input.leadDays(),input.incoterm(),
            optional(input.port()),optional(input.notes()),actor());
        db.update("""
            INSERT INTO rfq_activity(id,rfq_id,actor,action,detail)
            VALUES(?,?,?,?,?)
            """,UUID.randomUUID(),rfqId,actor(),"LINE_QUOTE_REVISED",
                "Item "+input.itemId()+" supplier "+input.supplierId()+" revision "+revision);
        audit.log("LINE_QUOTE_REVISED","RFQ",rfqId,
            "Item "+input.itemId()+" supplier "+input.supplierId()+" revision "+revision);
        return db.query(SELECT+" WHERE p.id=?",RfqLineOffersController::map,id)
            .stream().findFirst().orElseThrow();
    }
}
