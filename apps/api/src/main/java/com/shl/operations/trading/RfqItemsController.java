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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Separate from commercial supplier offer / order pricing until
 * full multi-line RFQ-to-quote matching has been reviewed.
 */
@RestController
@RequestMapping("/api/rfqs/{rfqId}/items")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
public class RfqItemsController {
    private final JdbcTemplate db;
    private final AuditService audit;

    public RfqItemsController(JdbcTemplate db, AuditService audit) {
        this.db = db;
        this.audit = audit;
    }

    public record ItemInput(
        @NotBlank @Size(max=240) String productName,
        @Size(max=3000) String specifications,
        @Pattern(regexp="[0-9]{4,10}") String hsCode,
        @NotNull @DecimalMin("0.001") @Digits(integer=15,fraction=3) BigDecimal quantity,
        @NotBlank @Size(max=32) String unit,
        @Size(max=500) String toleranceNotes,
        @Size(max=100) String originCountry,
        @Size(max=160) String targetDestination
    ) {}

    public record ItemRow(
        UUID id, UUID rfqId, int lineNumber, String productName, String specifications,
        String hsCode, BigDecimal quantity, String unit, String toleranceNotes,
        String originCountry, String targetDestination, Instant createdAt, Instant updatedAt
    ) {}

    private static String clean(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }

    private static ItemRow map(java.sql.ResultSet rs, int ignored) throws java.sql.SQLException {
        return new ItemRow(
            rs.getObject("id",UUID.class),
            rs.getObject("rfq_id",UUID.class),
            rs.getInt("line_number"),
            rs.getString("product_name"),
            rs.getString("specifications"),
            rs.getString("hs_code"),
            rs.getBigDecimal("quantity"),
            rs.getString("unit"),
            rs.getString("tolerance_notes"),
            rs.getString("origin_country"),
            rs.getString("target_destination"),
            rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant()
        );
    }

    private static final String SELECT = """
        SELECT id,rfq_id,line_number,product_name,specifications,hs_code,quantity,
          unit,tolerance_notes,origin_country,target_destination,created_at,updated_at
        FROM rfq_line_items WHERE rfq_id=?
        """;

    private void requireRfq(UUID id) {
        Long count=db.queryForObject("SELECT count(*) FROM rfqs WHERE id=?", Long.class,id);
        if (count==null || count==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"RFQ not found");
    }

    /** Lock parent before any change to serialize with supplier offers and state transitions. */
    private void requireEditable(UUID rfqId) {
        String state=db.query("SELECT status FROM rfqs WHERE id=? FOR UPDATE",
            (rs,row)->rs.getString(1),rfqId).stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"RFQ not found"));
        if (!"NEW".equals(state) && !"SOURCING".equals(state))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "RFQ requirement lines are frozen after sourcing completes");
        Long offers=db.queryForObject(
            "SELECT count(*) FROM supplier_offers WHERE rfq_id=?",Long.class,rfqId);
        if (offers!=null && offers>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Requirements are frozen after the first supplier offer; start a new RFQ for revised scope");
        Long revised=db.queryForObject(
            "SELECT count(*) FROM rfq_line_offer_revisions WHERE rfq_id=?",Long.class,rfqId);
        if (revised!=null && revised>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Requirements are frozen after a supplier item quote has been recorded");
    }

    private ItemRow get(UUID rfqId,UUID itemId) {
        return db.query(SELECT+" AND id=?",RfqItemsController::map,rfqId,itemId)
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"Requirement line not found"));
    }

    @GetMapping
    public List<ItemRow> list(@PathVariable UUID rfqId) {
        requireRfq(rfqId);
        return db.query(SELECT+" ORDER BY line_number",RfqItemsController::map,rfqId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ItemRow add(@PathVariable UUID rfqId,@Valid @RequestBody ItemInput input) {
        requireEditable(rfqId);
        Integer position=db.query("""
            SELECT n FROM generate_series(1,50) AS n
            WHERE NOT EXISTS (
              SELECT 1 FROM rfq_line_items li WHERE li.rfq_id=? AND li.line_number=n
            )
            ORDER BY n LIMIT 1
            """,(rs,i)->rs.getInt(1),rfqId).stream().findFirst().orElse(null);
        if (position==null) throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Maximum 50 lines per inquiry");
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO rfq_line_items(id,rfq_id,line_number,product_name,specifications,
                hs_code,quantity,unit,tolerance_notes,origin_country,target_destination)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)
            """,id,rfqId,position,input.productName().trim(),clean(input.specifications()),
            clean(input.hsCode()),input.quantity(),input.unit().trim(),
            clean(input.toleranceNotes()),clean(input.originCountry()),
            clean(input.targetDestination()));
        audit.log("RFQ_LINE_ADDED","RFQ",rfqId,"Requirement line "+position);
        return get(rfqId,id);
    }

    @PutMapping("/{itemId}")
    @Transactional
    public ItemRow update(@PathVariable UUID rfqId,@PathVariable UUID itemId,
        @Valid @RequestBody ItemInput input) {
        requireEditable(rfqId);
        ItemRow original=get(rfqId,itemId);
        db.update("""
            UPDATE rfq_line_items
            SET product_name=?,specifications=?,hs_code=?,quantity=?,unit=?,
                tolerance_notes=?,origin_country=?,target_destination=?,updated_at=now()
            WHERE id=? AND rfq_id=?
            """,input.productName().trim(),clean(input.specifications()),
            clean(input.hsCode()),input.quantity(),input.unit().trim(),
            clean(input.toleranceNotes()),clean(input.originCountry()),
            clean(input.targetDestination()),itemId,rfqId);
        audit.log("RFQ_LINE_UPDATED","RFQ",rfqId,"Requirement line "+original.lineNumber());
        return get(rfqId,itemId);
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID rfqId,@PathVariable UUID itemId) {
        requireEditable(rfqId);
        ItemRow original=get(rfqId,itemId);
        db.update("DELETE FROM rfq_line_items WHERE rfq_id=? AND id=?",rfqId,itemId);
        audit.log("RFQ_LINE_REMOVED","RFQ",rfqId,"Requirement line "+original.lineNumber());
    }
}
