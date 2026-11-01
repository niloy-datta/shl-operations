package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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

@RestController
@RequestMapping("/api/finance")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','FINANCE')")
public class FinanceController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public FinanceController(JdbcTemplate db,AuditService audit) { this.db=db;this.audit=audit; }
    public record InvoiceInput(@NotNull UUID salesOrderId, UUID purchaseOrderId,
        @NotBlank String invoiceType,
        @NotNull @DecimalMin("0.01") @Digits(integer=18,fraction=2) BigDecimal amount,
        LocalDate dueDate) {}
    public record PaymentInput(@NotNull @DecimalMin("0.01") @Digits(integer=18,fraction=2) BigDecimal amount,
        @NotBlank @Size(max=120) String reference,@NotNull LocalDate paidOn) {}
    public record StatusInput(@NotBlank String status) {}
    private Map<String,Object> row(String sql,Object... values) {
        return db.queryForList(sql,values).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private void require(boolean ok,String message) {
        if (!ok) throw new ResponseStatusException(CONFLICT,message);
    }
    @GetMapping("/invoices")
    public Pages.Result list(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        String term=q==null?"":q.trim().toLowerCase(Locale.ROOT);
        term=term.substring(0,Math.min(100,term.length()));
        return Pages.of(db,"i.*,so.reference AS sales_reference,coalesce(p.paid,0) AS paid_amount",
            "FROM invoices i JOIN sales_orders so ON so.id=i.sales_order_id "+
                "LEFT JOIN (SELECT invoice_id,sum(amount) AS paid FROM invoice_payments GROUP BY invoice_id) p ON p.invoice_id=i.id",
            " WHERE lower(i.reference) LIKE ?",new Object[]{"%"+term+"%"},
            "ORDER BY i.created_at DESC,i.id DESC",page,size);
    }
    @GetMapping("/invoices/{id}")
    public Map<String,Object> get(@PathVariable UUID id) {
        return row("""
            SELECT i.*,coalesce((SELECT sum(amount) FROM invoice_payments p WHERE p.invoice_id=i.id),0) AS paid_amount
            FROM invoices i WHERE i.id=?
            """,id);
    }
    @PostMapping("/invoices")
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody InvoiceInput input) {
        require(List.of("PAYABLE","RECEIVABLE").contains(input.invoiceType()),
            "Invalid invoice type");
        var order=row("SELECT * FROM sales_orders WHERE id=? FOR UPDATE",input.salesOrderId());
        require(List.of("CONFIRMED","IN_PROGRESS","COMPLETED").contains(order.get("status")),
            "Confirm sales order first");
        BigDecimal ceiling=(BigDecimal)order.get("total_amount");
        if ("PAYABLE".equals(input.invoiceType())) {
            require(input.purchaseOrderId()!=null,"Payable requires purchase order");
            var po=row("SELECT * FROM purchase_orders WHERE id=?",input.purchaseOrderId());
            require(po.get("sales_order_id").equals(input.salesOrderId()),
                "Purchase order does not belong to this sale");
            require(List.of("ISSUED","RECEIVED").contains(po.get("status")),
                "Issue purchase order first");
            ceiling=(BigDecimal)po.get("total_amount");
        } else require(input.purchaseOrderId()==null,"Receivables must not include a purchase order");
        String sql="SELECT coalesce(sum(amount),0) FROM invoices WHERE "+(
            "PAYABLE".equals(input.invoiceType()) ? "purchase_order_id=?" : "sales_order_id=? AND invoice_type='RECEIVABLE'")+
            " AND status <> 'VOID'";
        BigDecimal invoiced=db.queryForObject(sql,BigDecimal.class,
            "PAYABLE".equals(input.invoiceType()) ? input.purchaseOrderId() : input.salesOrderId());
        require(invoiced!=null && invoiced.add(input.amount()).compareTo(ceiling)<=0,
            "Invoices cannot exceed the linked order amount");
        UUID id=UUID.randomUUID();
        String ref="INV-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT);
        db.update("""
            INSERT INTO invoices(id,reference,sales_order_id,purchase_order_id,invoice_type,
                amount,currency,due_date)
            VALUES(?,?,?,?,?,?,?,?)
            """,id,ref,input.salesOrderId(),input.purchaseOrderId(),input.invoiceType(),
            input.amount(),order.get("currency"),input.dueDate());
        audit.log("CREATED","INVOICE",id,input.invoiceType());
        return ResponseEntity.created(URI.create("/api/finance/invoices/"+id)).body(get(id));
    }
    @PatchMapping("/invoices/{id}/status")
    @Transactional
    public Map<String,Object> status(@PathVariable UUID id,@Valid @RequestBody StatusInput input) {
        var invoice=row("SELECT * FROM invoices WHERE id=? FOR UPDATE",id);
        String before=(String)invoice.get("status"),next=input.status();
        require(("DRAFT".equals(before) && List.of("ISSUED","VOID").contains(next))
            || ("ISSUED".equals(before) && "VOID".equals(next)),
            "Invalid invoice transition");
        if ("VOID".equals(next)) {
            Long payments=db.queryForObject("SELECT count(*) FROM invoice_payments WHERE invoice_id=?",Long.class,id);
            require(payments!=null && payments==0,"Paid invoices cannot be voided");
        }
        db.update("UPDATE invoices SET status=?,updated_at=now() WHERE id=?",next,id);
        audit.log("STATUS_CHANGED","INVOICE",id,before+" -> "+next);
        return get(id);
    }
    @GetMapping("/invoices/{id}/payments")
    public List<Map<String,Object>> payments(@PathVariable UUID id) {
        get(id);
        return db.queryForList("""
            SELECT id,amount,reference,paid_on,recorded_by,created_at
            FROM invoice_payments WHERE invoice_id=? ORDER BY created_at DESC LIMIT 200
            """,id);
    }
    @PostMapping("/invoices/{id}/payments")
    @Transactional
    public Map<String,Object> recordPayment(@PathVariable UUID id,@Valid @RequestBody PaymentInput input) {
        var invoice=row("SELECT * FROM invoices WHERE id=? FOR UPDATE",id);
        require("ISSUED".equals(invoice.get("status")),"Only issued invoices can receive payments");
        BigDecimal paid=db.queryForObject("""
            SELECT coalesce(sum(amount),0) FROM invoice_payments WHERE invoice_id=?
            """,BigDecimal.class,id);
        require(paid!=null && paid.add(input.amount()).compareTo((BigDecimal)invoice.get("amount"))<=0,
            "Payment exceeds unpaid invoice balance");
        String reference=input.reference().trim();
        Long duplicates=db.queryForObject("""
            SELECT count(*) FROM invoice_payments WHERE invoice_id=? AND reference=?
            """,Long.class,id,reference);
        require(duplicates!=null && duplicates==0,"Payment reference already recorded");
        UUID paymentId=UUID.randomUUID();
        db.update("""
            INSERT INTO invoice_payments(id,invoice_id,reference,amount,paid_on,recorded_by)
            VALUES(?,?,?,?,?,?)
            """,paymentId,id,reference,input.amount(),input.paidOn(),audit.actor());
        if (paid.add(input.amount()).compareTo((BigDecimal)invoice.get("amount"))==0)
            db.update("UPDATE invoices SET status='PAID',updated_at=now() WHERE id=?",id);
        audit.log("PAYMENT_RECORDED","INVOICE",id,"Payment "+paymentId);
        return get(id);
    }
    @GetMapping("/summary")
    public Map<String,Object> summary() {
        return Map.of(
          "receivables",totals("RECEIVABLE"),
          "payables",totals("PAYABLE"),
          "unpaidInvoices",db.queryForObject(
            "SELECT count(*) FROM invoices WHERE status='ISSUED'",Long.class)
        );
    }
    private List<Map<String,Object>> totals(String type) {
        return db.queryForList("""
            SELECT i.currency,sum(i.amount) AS invoiced,
                sum(coalesce(p.paid,0)) AS received,
                sum(i.amount-coalesce(p.paid,0)) AS remaining
            FROM invoices i LEFT JOIN (
               SELECT invoice_id,sum(amount) AS paid FROM invoice_payments GROUP BY invoice_id
            ) p ON p.invoice_id=i.id
            WHERE i.invoice_type=? AND i.status IN ('ISSUED','PAID')
            GROUP BY i.currency ORDER BY i.currency
            """,type);
    }
}
