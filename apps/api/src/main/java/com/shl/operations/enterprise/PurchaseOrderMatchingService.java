package com.shl.operations.enterprise;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class PurchaseOrderMatchingService
{
    private final JdbcTemplate db;

    public PurchaseOrderMatchingService(JdbcTemplate db)
    {
        this.db = db;
    }

    public record Match(
        UUID purchaseOrderId,
        UUID salesOrderId,
        boolean matched,
        int expectedLines,
        int actualLines,
        String currency,
        List<String> discrepancies)
    {
    }

    private boolean amount(Object a, Object b)
    {
        return a instanceof BigDecimal left && b instanceof BigDecimal right
            && left.compareTo(right)==0;
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    public Match verify(UUID purchaseOrderId)
    {
        Map<String,Object> header=db.queryForList("""
            SELECT p.id,p.sales_order_id,p.supplier_id,p.currency AS purchase_currency,
                   p.total_amount AS purchase_total,
                   s.currency AS sales_currency
            FROM line_purchase_orders p
            JOIN line_sales_orders s ON s.id=p.sales_order_id
            WHERE p.id=?
            """,purchaseOrderId).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(NOT_FOUND,
                "Purchase order not found"));
        UUID salesOrderId=(UUID)header.get("sales_order_id");
        UUID supplierId=(UUID)header.get("supplier_id");
        int expected=db.queryForObject("""
            SELECT count(*) FROM line_sales_order_items
            WHERE sales_order_id=? AND supplier_id=?
            """,Integer.class,salesOrderId,supplierId);
        var rows=db.queryForList("""
            SELECT p.id AS purchase_line_id,p.sales_order_item_id,
                   p.source_revision_id AS purchase_revision_id,
                   p.product_name AS purchase_product,p.unit AS purchase_unit,
                   p.quantity AS purchase_quantity,p.unit_cost AS purchase_unit_cost,
                   p.cost_total AS purchase_cost_total,
                   s.id AS source_id,s.source_revision_id AS sales_revision_id,
                   s.supplier_id AS sales_supplier_id,
                   s.product_name AS sales_product,s.unit AS sales_unit,
                   s.quantity AS sales_quantity,
                   s.source_unit_cost AS sales_unit_cost,s.cost_total AS sales_cost_total
            FROM line_purchase_order_items p
            LEFT JOIN line_sales_order_items s ON s.id=p.sales_order_item_id
            WHERE p.purchase_order_id=?
            ORDER BY p.id
            """,purchaseOrderId);

        List<String> issues=new ArrayList<>();
        String purchaseCurrency=String.valueOf(header.get("purchase_currency")).trim();
        String salesCurrency=String.valueOf(header.get("sales_currency")).trim();
        if(!Objects.equals(purchaseCurrency,salesCurrency))
        {
            issues.add("Purchase order and sales order currencies differ.");
        }
        if(expected==0 || rows.isEmpty())
        {
            issues.add("No source line allocations exist for this supplier.");
        }
        if(expected!=rows.size())
        {
            issues.add("Purchase order line count does not match supplier allocation.");
        }
        BigDecimal total=BigDecimal.ZERO;
        for(var line:rows)
        {
            String name="PO line "+line.get("purchase_line_id");
            if(line.get("source_id")==null)
            {
                issues.add(name+" has no corresponding sales-order line.");
                continue;
            }
            if(!Objects.equals(line.get("sales_supplier_id"),supplierId))
            {
                issues.add(name+" belongs to another supplier.");
            }
            if(!Objects.equals(line.get("purchase_revision_id"),line.get("sales_revision_id")))
            {
                issues.add(name+" quotes a different supplier price revision.");
            }
            if(!Objects.equals(line.get("purchase_product"),line.get("sales_product")) ||
               !Objects.equals(line.get("purchase_unit"),line.get("sales_unit")))
            {
                issues.add(name+" product specification or unit changed.");
            }
            if(!amount(line.get("purchase_quantity"),line.get("sales_quantity")))
            {
                issues.add(name+" quantity does not match its sales allocation.");
            }
            if(!amount(line.get("purchase_unit_cost"),line.get("sales_unit_cost")) ||
               !amount(line.get("purchase_cost_total"),line.get("sales_cost_total")))
            {
                issues.add(name+" unit or extended supplier cost changed.");
            }
            total=total.add((BigDecimal)line.get("purchase_cost_total"));
        }
        if(!amount(total,header.get("purchase_total")))
        {
            issues.add("Supplier line totals do not match purchase-order total.");
        }
        return new Match(purchaseOrderId,salesOrderId,issues.isEmpty(),
            expected,rows.size(),purchaseCurrency,List.copyOf(issues));
    }
}
