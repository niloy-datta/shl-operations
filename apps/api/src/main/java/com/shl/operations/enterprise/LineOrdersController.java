package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.net.URI;
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
 * Isolated multi-line commercial order and supplier PO allocation.
 * No legacy shipment, ledger, payments or external release is triggered.
 */
@RestController
@RequestMapping("/api/commerce/line-orders")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
public class LineOrdersController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public LineOrdersController(JdbcTemplate db,AuditService audit) {
        this.db=db;this.audit=audit;
    }
    public record FromQuote(@NotNull UUID quoteId) {}
    public record SupplierSelection(@NotNull UUID supplierId) {}
    public record Transition(@NotBlank String status) {}
    public record OrderDetails(Map<String,Object> order,List<Map<String,Object>> lines,
        List<Map<String,Object>> purchaseOrders) {}
    public record PurchaseDetails(Map<String,Object> purchase,List<Map<String,Object>> lines) {}

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(CONFLICT,message);
    }
    private Map<String,Object> one(String sql,Object...args) {
        return db.queryForList(sql,args).stream().findFirst().orElseThrow(
            ()->new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private String reference(String prefix,UUID id) {
        return prefix+"-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT);
    }
    private LocalDate asDate(Object d) {
        if(d==null)return null;
        if(d instanceof java.sql.Date x)return x.toLocalDate();
        if(d instanceof LocalDate x)return x;
        throw new IllegalStateException("Unknown date representation");
    }

    @GetMapping
    public Pages.Result list(@RequestParam(required=false) UUID rfqId,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        String where=rfqId==null?"":" WHERE o.rfq_id=?";
        return Pages.of(db,"o.*,c.name AS customer_name",
            "FROM line_sales_orders o JOIN customers c ON c.id=o.customer_id",
            where,rfqId==null?new Object[]{}:new Object[]{rfqId},
            "ORDER BY o.created_at DESC,o.id DESC",page,size);
    }

    @GetMapping("/{id}")
    public OrderDetails detail(@PathVariable UUID id) {
        var order=one("""
            SELECT o.*,c.name AS customer_name FROM line_sales_orders o
            JOIN customers c ON c.id=o.customer_id WHERE o.id=?
            """,id);
        var lines=db.queryForList("""
            SELECT i.*,s.name AS supplier_name
            FROM line_sales_order_items i JOIN suppliers s ON s.id=i.supplier_id
            WHERE i.sales_order_id=? ORDER BY i.product_name,i.id
            """,id);
        var pos=db.queryForList("""
            SELECT p.*,s.name AS supplier_name
            FROM line_purchase_orders p JOIN suppliers s ON s.id=p.supplier_id
            WHERE p.sales_order_id=? ORDER BY p.created_at,p.id
            """,id);
        return new OrderDetails(order,lines,pos);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public ResponseEntity<OrderDetails> create(@Valid @RequestBody FromQuote input) {
        // Quote lock serializes competing order creations and freezes source identity.
        var quote=one("""
            SELECT q.*,r.customer_id FROM customer_line_quotes q
            JOIN rfqs r ON r.id=q.rfq_id
            WHERE q.id=? FOR UPDATE OF q
            """,input.quoteId());
        if(!"APPROVED".equals(quote.get("status")))
            throw conflict("Only independently approved line quotations can create orders");
        LocalDate expiry=asDate(quote.get("valid_until"));
        if(expiry!=null && expiry.isBefore(LocalDate.now(java.time.ZoneOffset.UTC)))
            throw conflict("Approved quotation has expired");
        if(!db.queryForList("SELECT id FROM line_sales_orders WHERE quote_id=?",
            input.quoteId()).isEmpty())
            throw conflict("This line quotation already has a sales order");
        var lines=db.queryForList("""
            SELECT * FROM customer_line_quote_items WHERE quote_id=?
            ORDER BY rfq_item_id
            """,input.quoteId());
        if(lines.isEmpty())throw conflict("Quotation has no priced product lines");
        BigDecimal sum=BigDecimal.ZERO;
        for(var line:lines)sum=sum.add((BigDecimal)line.get("sell_total"));
        if(sum.compareTo((BigDecimal)quote.get("total_sell"))!=0)
            throw conflict("Quotation line totals do not reconcile");
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO line_sales_orders
            (id,reference,quote_id,rfq_id,customer_id,currency,total_amount,created_by)
            VALUES(?,?,?,?,?,?,?,?)
            """,id,reference("LSO",id),input.quoteId(),quote.get("rfq_id"),
            quote.get("customer_id"),quote.get("currency"),quote.get("total_sell"),audit.actor());
        for(var line:lines) db.update("""
            INSERT INTO line_sales_order_items
            (id,sales_order_id,quote_line_id,rfq_item_id,source_revision_id,supplier_id,
             product_name,unit,quantity,sell_unit_price,sell_total,source_unit_cost,cost_total)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,UUID.randomUUID(),id,line.get("id"),line.get("rfq_item_id"),
            line.get("source_revision_id"),line.get("supplier_id"),line.get("product_name"),
            line.get("unit"),line.get("quantity"),line.get("sell_unit_price"),
            line.get("sell_total"),line.get("source_unit_cost"),line.get("cost_total"));
        audit.log("CREATED","LINE_SALES_ORDER",id,"From approved quote "+input.quoteId());
        return ResponseEntity.created(URI.create("/api/commerce/line-orders/"+id)).body(detail(id));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public OrderDetails status(@PathVariable UUID id,@Valid @RequestBody Transition input) {
        var order=one("SELECT * FROM line_sales_orders WHERE id=? FOR UPDATE",id);
        String before=(String)order.get("status"),next=input.status();
        if("DRAFT".equals(before) && "CONFIRMED".equals(next)) {
            if(audit.actor().equals(order.get("created_by")))
                throw conflict("Independent manager must confirm the sales order");
            db.update("""
                UPDATE line_sales_orders SET status='CONFIRMED',confirmed_by=?,
                    updated_at=now() WHERE id=?
                """,audit.actor(),id);
        } else if("DRAFT".equals(before) && "CANCELLED".equals(next)) {
            db.update("UPDATE line_sales_orders SET status='CANCELLED',updated_at=now() WHERE id=?",id);
        } else if("CONFIRMED".equals(before) && "CANCELLED".equals(next)) {
            Long count=db.queryForObject(
                "SELECT count(*) FROM line_purchase_orders WHERE sales_order_id=?",Long.class,id);
            if(count!=null && count>0)
                throw conflict("Order has supplier POs; use a reviewed amendment process");
            db.update("UPDATE line_sales_orders SET status='CANCELLED',updated_at=now() WHERE id=?",id);
        } else throw conflict("Invalid sales order status transition");
        audit.log("STATUS_CHANGED","LINE_SALES_ORDER",id,before+" -> "+next);
        return detail(id);
    }

    @PostMapping("/{id}/purchase-orders")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    @Transactional
    public ResponseEntity<PurchaseDetails> createPurchase(@PathVariable UUID id,
        @Valid @RequestBody SupplierSelection input) {
        var order=one("SELECT * FROM line_sales_orders WHERE id=? FOR UPDATE",id);
        if(!"CONFIRMED".equals(order.get("status")))
            throw conflict("Confirm sales order before supplier procurement");
        var lines=db.queryForList("""
            SELECT * FROM line_sales_order_items
            WHERE sales_order_id=? AND supplier_id=? ORDER BY id
            """,id,input.supplierId());
        if(lines.isEmpty())throw conflict("Supplier has no approved line allocation in this order");
        if(!db.queryForList("""
            SELECT id FROM line_purchase_orders WHERE sales_order_id=? AND supplier_id=?
            """,id,input.supplierId()).isEmpty())
            throw conflict("Supplier PO already exists; duplicate allocation forbidden");
        BigDecimal sum=BigDecimal.ZERO;
        for(var line:lines)sum=sum.add((BigDecimal)line.get("cost_total"));
        if(sum.signum()<=0)throw conflict("Supplier cost total must be positive");
        UUID poId=UUID.randomUUID();
        db.update("""
            INSERT INTO line_purchase_orders
            (id,reference,sales_order_id,supplier_id,currency,total_amount,created_by)
            VALUES(?,?,?,?,?,?,?)
            """,poId,reference("LPO",poId),id,input.supplierId(),
            order.get("currency"),sum,audit.actor());
        for(var line:lines)db.update("""
            INSERT INTO line_purchase_order_items
            (id,purchase_order_id,sales_order_item_id,source_revision_id,product_name,
             unit,quantity,unit_cost,cost_total) VALUES(?,?,?,?,?,?,?,?,?)
            """,UUID.randomUUID(),poId,line.get("id"),line.get("source_revision_id"),
            line.get("product_name"),line.get("unit"),line.get("quantity"),
            line.get("source_unit_cost"),line.get("cost_total"));
        audit.log("CREATED","LINE_PURCHASE_ORDER",poId,
            "Supplier allocation from line sales order "+id);
        return ResponseEntity.created(URI.create("/api/commerce/line-orders/purchase-orders/"+poId))
            .body(purchase(poId));
    }

    @GetMapping("/purchase-orders/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    public PurchaseDetails purchase(@PathVariable UUID id) {
        var po=one("""
            SELECT p.*,s.name AS supplier_name FROM line_purchase_orders p
            JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?
            """,id);
        var lines=db.queryForList("""
            SELECT * FROM line_purchase_order_items
            WHERE purchase_order_id=? ORDER BY product_name,id
            """,id);
        return new PurchaseDetails(po,lines);
    }

    @PatchMapping("/purchase-orders/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public PurchaseDetails purchaseStatus(@PathVariable UUID id,
        @Valid @RequestBody Transition input) {
        var po=one("SELECT * FROM line_purchase_orders WHERE id=? FOR UPDATE",id);
        String before=(String)po.get("status"),next=input.status();
        if(!"DRAFT".equals(before) || !Set.of("ISSUED","CANCELLED").contains(next))
            throw conflict("Invalid PO transition");
        if("ISSUED".equals(next)) {
            if(audit.actor().equals(po.get("created_by")))
                throw conflict("Four-eyes: PO creator cannot issue their own order");
            db.update("""
                UPDATE line_purchase_orders SET status='ISSUED',issued_by=?,updated_at=now()
                WHERE id=?
                """,audit.actor(),id);
        } else {
            db.update("UPDATE line_purchase_orders SET status='CANCELLED',updated_at=now() WHERE id=?",id);
        }
        audit.log("STATUS_CHANGED","LINE_PURCHASE_ORDER",id,before+" -> "+next);
        return purchase(id);
    }
}
