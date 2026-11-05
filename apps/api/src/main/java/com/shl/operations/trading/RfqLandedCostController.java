package com.shl.operations.trading;

import com.shl.operations.enterprise.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/rfqs/{rfqId}/landed-cost")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
public class RfqLandedCostController
{
    private final JdbcTemplate db;
    private final AuditService audit;

    public RfqLandedCostController(JdbcTemplate db, AuditService audit)
    {
        this.db = db;
        this.audit = audit;
    }

    public record ScenarioInput(
        @NotNull UUID sourceRevisionId,
        @NotNull @DecimalMin("0.00") @Digits(integer=16,fraction=2) BigDecimal freight,
        @NotNull @DecimalMin("0.00") @Digits(integer=16,fraction=2) BigDecimal insurance,
        @NotNull @DecimalMin("0.00") @Digits(integer=16,fraction=2) BigDecimal duty,
        @NotNull @DecimalMin("0.00") @Digits(integer=16,fraction=2) BigDecimal handling,
        @NotBlank @Size(max=600) String assumptionSource)
    {
    }

    private Map<String,Object> rfq(UUID id, boolean lock)
    {
        return db.queryForList("SELECT id,status,currency FROM rfqs WHERE id=?" +
            (lock ? " FOR UPDATE" : ""),id).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "RFQ not found"));
    }

    @GetMapping
    public List<Map<String,Object>> list(@PathVariable UUID rfqId)
    {
        rfq(rfqId,false);
        return db.queryForList("""
            SELECT x.id,x.rfq_id,x.item_id,i.line_number,i.product_name,i.unit,
                   x.supplier_id,s.name AS supplier_name,
                   x.source_revision_id,x.source_revision_number,
                   x.currency,x.incoterm,x.port,x.quantity,x.source_unit_price,
                   x.freight,x.insurance,x.duty,x.handling,x.estimated_total,
                   x.estimated_unit_cost,x.assumption_source,x.created_by,x.created_at
            FROM rfq_landed_cost_scenarios x
            JOIN rfq_line_items i ON i.id=x.item_id
            JOIN suppliers s ON s.id=x.supplier_id
            WHERE x.rfq_id=?
            ORDER BY i.line_number,x.estimated_unit_cost ASC,x.created_at DESC,x.id DESC
            LIMIT 500
            """,rfqId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@PathVariable UUID rfqId,
        @Valid @RequestBody ScenarioInput input)
    {
        Map<String,Object> header=rfq(rfqId,true);
        if (!"SOURCING".equals(header.get("status")))
        {
            throw new ResponseStatusException(CONFLICT,
                "Cost scenarios may only be recorded during sourcing");
        }
        var offers=db.queryForList("""
            SELECT p.*,i.quantity AS required_quantity
            FROM rfq_line_offer_revisions p
            JOIN rfq_line_items i ON i.id=p.item_id AND i.rfq_id=p.rfq_id
            WHERE p.id=? AND p.rfq_id=?
            """,input.sourceRevisionId(),rfqId);
        if (offers.isEmpty())
        {
            throw new ResponseStatusException(NOT_FOUND,
                "Source supplier revision does not belong to this RFQ");
        }
        Map<String,Object> price=offers.getFirst();
        UUID itemId=(UUID)price.get("item_id");
        UUID supplierId=(UUID)price.get("supplier_id");
        UUID latest=db.queryForObject("""
            SELECT id FROM rfq_line_offer_revisions
            WHERE item_id=? AND supplier_id=?
            ORDER BY revision_number DESC LIMIT 1
            """,UUID.class,itemId,supplierId);
        if (!Objects.equals(latest,input.sourceRevisionId()))
        {
            throw new ResponseStatusException(CONFLICT,
                "Outdated supplier quote revision; use the latest revision");
        }
        BigDecimal quantity=(BigDecimal)price.get("required_quantity");
        BigDecimal moq=(BigDecimal)price.get("moq");
        if (moq.compareTo(quantity)>0)
        {
            throw new ResponseStatusException(CONFLICT,
                "Supplier minimum order exceeds requested line quantity");
        }
        BigDecimal unitPrice=(BigDecimal)price.get("unit_price");
        BigDecimal base=unitPrice.multiply(quantity).setScale(2,RoundingMode.HALF_UP);
        BigDecimal total=base.add(input.freight()).add(input.insurance())
            .add(input.duty()).add(input.handling()).setScale(2,RoundingMode.HALF_UP);
        BigDecimal estimateUnit=total.divide(quantity,4,RoundingMode.HALF_UP);
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO rfq_landed_cost_scenarios
              (id,rfq_id,item_id,supplier_id,source_revision_id,source_revision_number,
               currency,incoterm,port,quantity,source_unit_price,
               freight,insurance,duty,handling,estimated_total,estimated_unit_cost,
               assumption_source,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,id,rfqId,itemId,supplierId,input.sourceRevisionId(),
            price.get("revision_number"),
            ((String)header.get("currency")).trim().toUpperCase(Locale.ROOT),
            price.get("incoterm"),price.get("port"),
            quantity,unitPrice,input.freight(),input.insurance(),input.duty(),
            input.handling(),total,estimateUnit,input.assumptionSource().trim(),audit.actor());
        audit.log("LANDED_COST_ESTIMATED","RFQ",rfqId,
            "Scenario "+id+" based on supplier quote "+input.sourceRevisionId());
        return ResponseEntity.created(URI.create(
            "/api/rfqs/"+rfqId+"/landed-cost")).body(
            db.queryForMap("SELECT * FROM rfq_landed_cost_scenarios WHERE id=?",id));
    }
}
