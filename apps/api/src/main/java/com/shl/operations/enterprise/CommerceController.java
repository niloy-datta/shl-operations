package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
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

@RestController
@RequestMapping("/api/commerce")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE')")
public class CommerceController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public CommerceController(JdbcTemplate db, AuditService audit) {
        this.db = db; this.audit = audit;
    }
    public record QuoteInput(@NotNull UUID rfqId,
        @NotNull @DecimalMin("0.0001") @Digits(integer=14,fraction=4) BigDecimal unitPrice,
        LocalDate validUntil) {}
    public record OrderInput(@NotNull UUID quoteId) {}
    public record PurchaseInput(@NotNull UUID salesOrderId, @NotNull UUID supplierOfferId,
        @NotNull @DecimalMin("0.001") @Digits(integer=15,fraction=3) BigDecimal quantity) {}
    public record StatusInput(@NotBlank String status) {}

    private Map<String,Object> locked(String sql, Object... args) {
        return db.queryForList(sql, args).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Record not found"));
    }
    private void require(boolean ok, String message) {
        if (!ok) throw new ResponseStatusException(CONFLICT, message);
    }
    private String ref(String prefix, UUID id) {
        return prefix + "-" + id.toString().substring(0, 12).toUpperCase(Locale.ROOT);
    }
    private BigDecimal total(BigDecimal quantity, BigDecimal price) {
        return quantity.multiply(price).setScale(2, RoundingMode.HALF_UP);
    }
    private Pages.Result list(String select, String from, String searchField, String q, String order,
        int page, int size) {
        String term = q == null ? "" : q.trim();
        term = term.substring(0, Math.min(100, term.length())).toLowerCase(Locale.ROOT);
        return Pages.of(db, select, from, " WHERE lower(" + searchField + ") LIKE ?",
            new Object[] { "%" + term + "%" }, order, page, size);
    }
    @GetMapping("/quotes")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
    public Pages.Result quotes(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return list("cq.*,r.reference AS rfq_reference,r.subject,c.name AS customer_name",
            "FROM customer_quotes cq JOIN rfqs r ON r.id=cq.rfq_id JOIN customers c ON c.id=r.customer_id",
            "r.subject",q,"ORDER BY cq.created_at DESC, cq.id DESC",page,size);
    }
    @PostMapping("/quotes")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public ResponseEntity<Map<String,Object>> createQuote(@Valid @RequestBody QuoteInput input) {
        var rfq = locked("SELECT id,status,quantity,currency FROM rfqs WHERE id=? FOR UPDATE", input.rfqId());
        require("READY_FOR_QUOTE".equals(rfq.get("status")), "RFQ must be ready for quote");
        UUID id = UUID.randomUUID();
        Integer version = db.queryForObject("SELECT coalesce(max(version),0)+1 FROM customer_quotes WHERE rfq_id=?",
            Integer.class,input.rfqId());
        db.update("""
            INSERT INTO customer_quotes(id,rfq_id,version,unit_price,quantity,currency,valid_until,created_by)
            VALUES(?,?,?,?,?,?,?,?)
            """, id,input.rfqId(),version,input.unitPrice(),rfq.get("quantity"),
            rfq.get("currency"),input.validUntil(),audit.actor());
        audit.log("CREATED","QUOTE",id,"RFQ "+input.rfqId());
        return ResponseEntity.created(URI.create("/api/commerce/quotes/"+id)).body(getQuote(id));
    }
    @GetMapping("/quotes/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
    public Map<String,Object> getQuote(@PathVariable UUID id) {
        return locked("SELECT * FROM customer_quotes WHERE id=?",id);
    }
    @PatchMapping("/quotes/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public Map<String,Object> quoteStatus(@PathVariable UUID id, @Valid @RequestBody StatusInput input) {
        var quote = locked("SELECT * FROM customer_quotes WHERE id=? FOR UPDATE", id);
        String before=(String)quote.get("status"), next=input.status();
        boolean allowed = ("DRAFT".equals(before) && "SUBMITTED".equals(next))
            || ("SUBMITTED".equals(before) && List.of("APPROVED","REJECTED").contains(next));
        require(allowed,"Invalid quotation transition");
        if (List.of("APPROVED","REJECTED").contains(next)) {
            var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            require(auth != null && auth.getAuthorities().stream().anyMatch(a ->
                List.of("ROLE_ADMIN","ROLE_MANAGEMENT").contains(a.getAuthority())),
                "Management approval required");
        }
        if ("APPROVED".equals(next)) {
            require(!audit.actor().equals(quote.get("created_by")),
                "Four-eyes approval: quote creator cannot approve their own quotation");
            LocalDate validUntil=(LocalDate)quote.get("valid_until");
            require(validUntil==null || !validUntil.isBefore(LocalDate.now()),
                "Expired quotes cannot be approved");
            Long prior=db.queryForObject(
                "SELECT count(*) FROM customer_quotes WHERE rfq_id=? AND status='APPROVED' AND id<>?",
                Long.class,quote.get("rfq_id"),id);
            require(prior!=null && prior==0,"An approved version already exists for this RFQ");
        }
        db.update("UPDATE customer_quotes SET status=?,approved_by=?,updated_at=now() WHERE id=?",
            next,"APPROVED".equals(next) ? audit.actor() : null,id);
        audit.log("STATUS_CHANGED","QUOTE",id,before+" -> "+next);
        return getQuote(id);
    }
    @GetMapping("/orders")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE')")
    public Pages.Result orders(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return list("so.*, c.name AS customer_name, r.subject AS rfq_subject",
            "FROM sales_orders so JOIN customers c ON c.id=so.customer_id JOIN rfqs r ON r.id=so.rfq_id",
            "so.reference",q,"ORDER BY so.created_at DESC, so.id DESC",page,size);
    }
    @PostMapping("/orders")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public ResponseEntity<Map<String,Object>> createOrder(@Valid @RequestBody OrderInput input) {
        var quote=locked("""
            SELECT cq.*,r.customer_id FROM customer_quotes cq JOIN rfqs r ON r.id=cq.rfq_id
            WHERE cq.id=? FOR UPDATE OF cq
            """, input.quoteId());
        require("APPROVED".equals(quote.get("status")), "Only approved quotes can become orders");
        LocalDate validUntil=(LocalDate)quote.get("valid_until");
        require(validUntil==null || !validUntil.isBefore(LocalDate.now()),
            "Expired customer quotation cannot become a sales order");
        UUID id=UUID.randomUUID();
        BigDecimal amount=total((BigDecimal)quote.get("quantity"),(BigDecimal)quote.get("unit_price"));
        require(amount.signum()>0,"Order total must be positive");
        db.update("""
            INSERT INTO sales_orders(id,reference,quote_id,rfq_id,customer_id,total_amount,currency)
            VALUES(?,?,?,?,?,?,?)
            """,id,ref("SO",id),input.quoteId(),quote.get("rfq_id"),quote.get("customer_id"),
            amount,quote.get("currency"));
        audit.log("CREATED","SALES_ORDER",id,"Quote "+input.quoteId());
        return ResponseEntity.created(URI.create("/api/commerce/orders/"+id)).body(getOrder(id));
    }
    @GetMapping("/orders/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE')")
    public Map<String,Object> getOrder(@PathVariable UUID id) {
        return locked("SELECT * FROM sales_orders WHERE id=?",id);
    }
    @PatchMapping("/orders/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public Map<String,Object> orderStatus(@PathVariable UUID id,@Valid @RequestBody StatusInput input) {
        var order=locked("SELECT * FROM sales_orders WHERE id=? FOR UPDATE",id);
        String before=(String)order.get("status"), next=input.status();
        Map<String,String> stages=Map.of("DRAFT","CONFIRMED","CONFIRMED","IN_PROGRESS",
            "IN_PROGRESS","COMPLETED");
        require(Objects.equals(stages.get(before),next)
            || (List.of("DRAFT","CONFIRMED").contains(before) && "CANCELLED".equals(next)),
            "Invalid sales order transition");
        if ("COMPLETED".equals(next)) {
            Long delivered=db.queryForObject("SELECT count(*) FROM shipments WHERE sales_order_id=? AND status='DELIVERED'",
                Long.class,id);
            Long open=db.queryForObject("SELECT count(*) FROM shipments WHERE sales_order_id=? AND status <> 'DELIVERED'",
                Long.class,id);
            require(delivered != null && delivered > 0 && open != null && open == 0,
                "At least one delivered shipment and no outstanding shipments are required");
        }
        db.update("UPDATE sales_orders SET status=?,updated_at=now() WHERE id=?",next,id);
        audit.log("STATUS_CHANGED","SALES_ORDER",id,before+" -> "+next);
        return getOrder(id);
    }
    @GetMapping("/purchase-orders")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING','LOGISTICS','FINANCE')")
    public Pages.Result purchaseOrders(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return list("po.*,s.name AS supplier_name,so.reference AS sales_reference",
            "FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id JOIN sales_orders so ON so.id=po.sales_order_id",
            "po.reference",q,"ORDER BY po.created_at DESC,po.id DESC",page,size);
    }
    @PostMapping("/purchase-orders")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    @Transactional
    public ResponseEntity<Map<String,Object>> createPurchase(@Valid @RequestBody PurchaseInput input) {
        var order=locked("SELECT * FROM sales_orders WHERE id=? FOR UPDATE",input.salesOrderId());
        require(List.of("CONFIRMED","IN_PROGRESS").contains(order.get("status")),
            "Sales order must be confirmed");
        var offer=locked("SELECT * FROM supplier_offers WHERE id=?",input.supplierOfferId());
        require(order.get("rfq_id").equals(offer.get("rfq_id")), "Offer does not belong to order RFQ");
        require(input.quantity().compareTo((BigDecimal)offer.get("moq"))>=0,
            "Purchase quantity must meet supplier MOQ");
        UUID id=UUID.randomUUID();
        BigDecimal amount=total(input.quantity(),(BigDecimal)offer.get("unit_price"));
        db.update("""
            INSERT INTO purchase_orders(id,reference,sales_order_id,supplier_offer_id,supplier_id,
                quantity,unit_price,total_amount,currency)
            VALUES(?,?,?,?,?,?,?,?,?)
            """,id,ref("PO",id),input.salesOrderId(),input.supplierOfferId(),
            offer.get("supplier_id"),input.quantity(),offer.get("unit_price"),amount,order.get("currency"));
        audit.log("CREATED","PURCHASE_ORDER",id,"Sales order "+input.salesOrderId());
        return ResponseEntity.created(URI.create("/api/commerce/purchase-orders/"+id)).body(getPurchase(id));
    }
    @GetMapping("/purchase-orders/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING','LOGISTICS','FINANCE')")
    public Map<String,Object> getPurchase(@PathVariable UUID id) {
        return locked("SELECT * FROM purchase_orders WHERE id=?",id);
    }
    @PatchMapping("/purchase-orders/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    @Transactional
    public Map<String,Object> purchaseStatus(@PathVariable UUID id,@Valid @RequestBody StatusInput input) {
        var po=locked("SELECT * FROM purchase_orders WHERE id=? FOR UPDATE",id);
        String before=(String)po.get("status"),next=input.status();
        require(("DRAFT".equals(before) && List.of("ISSUED","CANCELLED").contains(next))
            || ("ISSUED".equals(before) && "RECEIVED".equals(next)),
            "Invalid purchase order transition");
        db.update("UPDATE purchase_orders SET status=?,updated_at=now() WHERE id=?",next,id);
        audit.log("STATUS_CHANGED","PURCHASE_ORDER",id,before+" -> "+next);
        return getPurchase(id);
    }
}
