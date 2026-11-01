package com.shl.operations.enterprise;

import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Order-value contribution estimate only. Does NOT represent recognized revenue,
 * cash profit, FX gain, tax-adjusted margin, or include confidential commissions.
 */
@RestController
@RequestMapping("/api/costs/profitability")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','FINANCE')")
public class ProjectProfitabilityController {
    private final JdbcTemplate db;
    public ProjectProfitabilityController(JdbcTemplate db){this.db=db;}

    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size){
        String term=q==null?"":q.trim().toLowerCase(Locale.ROOT);
        term=term.substring(0,Math.min(100,term.length()));
        return Pages.of(db,"""
            p.id,p.reference,p.title,p.status,
            c.name AS customer_name,so.reference AS order_reference,
            trim(so.currency) AS currency,so.total_amount AS order_value,
            coalesce(po.purchase_cost,0) AS committed_purchase_cost,
            coalesce(exp.approved_expenses,0) AS approved_expenses,
            po.purchased_quantity,cq.quantity AS quoted_quantity,
            CASE
              WHEN so.id IS NOT NULL AND po.purchased_quantity = cq.quantity
                AND po.purchase_count > 0
                AND NOT EXISTS (
                  SELECT 1 FROM project_expenses e
                  WHERE e.project_id=p.id AND e.status='DRAFT'
                )
              THEN so.total_amount-coalesce(po.purchase_cost,0)
                -coalesce(exp.approved_expenses,0)
              ELSE NULL
            END AS provisional_contribution
            """,
            """
            FROM business_projects p
            JOIN customers c ON c.id=p.customer_id
            LEFT JOIN sales_orders so ON so.id=p.sales_order_id
            LEFT JOIN customer_quotes cq ON cq.id=so.quote_id
            LEFT JOIN LATERAL (
              SELECT count(*) AS purchase_count,
                coalesce(sum(po2.quantity),0) AS purchased_quantity,
                coalesce(sum(po2.total_amount),0) AS purchase_cost
              FROM purchase_orders po2
              WHERE po2.sales_order_id=so.id AND po2.status IN ('ISSUED','RECEIVED')
            ) po ON true
            LEFT JOIN LATERAL (
              SELECT coalesce(sum(e.amount),0) AS approved_expenses
              FROM project_expenses e WHERE e.project_id=p.id AND e.status='APPROVED'
            ) exp ON true
            """,
            " WHERE (lower(p.title) LIKE ? OR lower(p.reference) LIKE ?)",
            new Object[]{"%"+term+"%","%"+term+"%"},
            "ORDER BY p.created_at DESC,p.id DESC",page,size);
    }
}
