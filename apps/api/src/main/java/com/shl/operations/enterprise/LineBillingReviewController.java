package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/**
 * Unposted billing preparation, not legal invoice issuance or accounting.
 * Requires complete staff-recorded delivery for all approved supplier allocations.
 */
@RestController
@RequestMapping("/api/finance/line-billing")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','FINANCE')")
public class LineBillingReviewController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public LineBillingReviewController(JdbcTemplate db,AuditService audit){
        this.db=db;this.audit=audit;
    }
    public record Create(@NotNull UUID salesOrderId,LocalDate dueDate) {}
    public record Review(@NotBlank @Pattern(regexp="REVIEWED|VOID") String decision,
        @NotBlank @Size(max=1000) String notes) {}
    public record Detail(Map<String,Object> billing,List<Map<String,Object>> lines) {}
    private Map<String,Object> one(String sql,Object...args){
        return db.queryForList(sql,args).stream().findFirst().orElseThrow(
            ()->new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private ResponseStatusException blocked(String message){
        return new ResponseStatusException(CONFLICT,message);
    }
    private String ref(UUID id) {
        return "BILL-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT);
    }
    private void eligible(UUID id){
        var pending=db.queryForObject("""
            SELECT count(*) FROM line_sales_order_items li
            WHERE li.sales_order_id=?
              AND NOT EXISTS (
                SELECT 1 FROM line_purchase_orders po
                JOIN line_shipments sh ON sh.purchase_order_id=po.id
                WHERE po.sales_order_id=li.sales_order_id
                  AND po.supplier_id=li.supplier_id
                  AND po.status='ISSUED' AND sh.status='DELIVERED'
              )
            """,Long.class,id);
        if(pending==null||pending>0)
            throw blocked("Every supplier's issued PO needs a delivered shipment");
        Long count=db.queryForObject(
            "SELECT count(*) FROM line_sales_order_items WHERE sales_order_id=?",
            Long.class,id);
        if(count==null||count==0)
            throw blocked("Cannot prepare billing without line items");
    }

    @GetMapping("/eligible-orders")
    public List<Map<String,Object>> eligibleOrders(){
        return db.queryForList("""
            SELECT o.id,o.reference,c.name AS customer_name,o.currency,o.total_amount
            FROM line_sales_orders o JOIN customers c ON c.id=o.customer_id
            WHERE o.status='CONFIRMED'
              AND NOT EXISTS(SELECT 1 FROM line_billing_candidates b WHERE b.sales_order_id=o.id)
              AND EXISTS(SELECT 1 FROM line_sales_order_items li WHERE li.sales_order_id=o.id)
              AND NOT EXISTS(
                SELECT 1 FROM line_sales_order_items li
                WHERE li.sales_order_id=o.id AND NOT EXISTS(
                  SELECT 1 FROM line_purchase_orders po
                  JOIN line_shipments sh ON sh.purchase_order_id=po.id
                  WHERE po.sales_order_id=o.id AND po.supplier_id=li.supplier_id
                    AND po.status='ISSUED' AND sh.status='DELIVERED'
                )
              )
            ORDER BY o.created_at DESC,o.id DESC LIMIT 100
            """);
    }

    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size) {
        return Pages.of(db,
            "b.*,o.reference AS order_reference,c.name AS customer_name",
            "FROM line_billing_candidates b JOIN line_sales_orders o ON o.id=b.sales_order_id "+
            "JOIN customers c ON c.id=b.customer_id",
            "",new Object[]{},"ORDER BY b.created_at DESC,b.id DESC",page,size);
    }

    @GetMapping("/{id}")
    public Detail detail(@PathVariable UUID id) {
        var billing=one("""
            SELECT b.*,o.reference AS order_reference,c.name AS customer_name
            FROM line_billing_candidates b JOIN line_sales_orders o ON o.id=b.sales_order_id
            JOIN customers c ON c.id=b.customer_id WHERE b.id=?
            """,id);
        var lines=db.queryForList("""
            SELECT id,sales_order_item_id,product_name,quantity,unit,sell_unit_price,line_total
            FROM line_billing_candidate_items WHERE billing_id=?
            ORDER BY product_name,id
            """,id);
        return new Detail(billing,lines);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Detail> create(@Valid @RequestBody Create input){
        Map<String,Object> order=one(
            "SELECT * FROM line_sales_orders WHERE id=? FOR UPDATE",input.salesOrderId());
        if(!"CONFIRMED".equals(order.get("status")))
            throw blocked("Sales order needs management confirmation");
        if(!db.queryForList(
            "SELECT id FROM line_billing_candidates WHERE sales_order_id=?",
            input.salesOrderId()).isEmpty())
            throw blocked("Billing review already prepared for this sales order");
        eligible(input.salesOrderId());
        var lines=db.queryForList("""
            SELECT id,product_name,quantity,unit,sell_unit_price,sell_total
            FROM line_sales_order_items WHERE sales_order_id=?
            ORDER BY id
            """,input.salesOrderId());
        BigDecimal sum=BigDecimal.ZERO;
        for(var item:lines)sum=sum.add((BigDecimal)item.get("sell_total"));
        if(sum.compareTo((BigDecimal)order.get("total_amount"))!=0)
            throw blocked("Line totals no longer match approved sales order");
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO line_billing_candidates
            (id,reference,sales_order_id,customer_id,currency,amount,due_date,created_by)
            VALUES(?,?,?,?,?,?,?,?)
            """,id,ref(id),input.salesOrderId(),order.get("customer_id"),
            order.get("currency"),order.get("total_amount"),input.dueDate(),audit.actor());
        for(var item:lines)db.update("""
            INSERT INTO line_billing_candidate_items
            (id,billing_id,sales_order_item_id,product_name,quantity,unit,sell_unit_price,line_total)
            VALUES(?,?,?,?,?,?,?,?)
            """,UUID.randomUUID(),id,item.get("id"),item.get("product_name"),
            item.get("quantity"),item.get("unit"),item.get("sell_unit_price"),
            item.get("sell_total"));
        audit.log("CREATED","LINE_BILLING",id,"Unposted billing review prepared");
        return ResponseEntity.created(URI.create("/api/finance/line-billing/"+id)).body(detail(id));
    }

    @PatchMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public Detail review(@PathVariable UUID id,@Valid @RequestBody Review input){
        var billing=one("SELECT * FROM line_billing_candidates WHERE id=? FOR UPDATE",id);
        if(!"DRAFT".equals(billing.get("status")))
            throw blocked("Only draft billing candidates can be reviewed");
        if(audit.actor().equals(billing.get("created_by")))
            throw blocked("Independent manager must review the billing candidate");
        db.update("""
            UPDATE line_billing_candidates SET status=?,review_notes=?,reviewed_by=?,
                updated_at=now() WHERE id=?
            """,input.decision(),input.notes().trim(),audit.actor(),id);
        audit.log("REVIEWED","LINE_BILLING",id,
            input.decision()+" by independent manager (no invoice issued)");
        return detail(id);
    }
}
