package com.shl.operations.enterprise;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/command-center")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
public class CommandCenterController {
    private final JdbcTemplate db;
    public CommandCenterController(JdbcTemplate db){this.db=db;}
    private long count(String sql,Object... args) {
        Long value=db.queryForObject(sql,Long.class,args);
        return value==null?0L:value;
    }
    @GetMapping("/summary")
    public Map<String,Object> summary() {
        LocalDate today=LocalDate.now(ZoneOffset.UTC);
        Map<String,Object> output=new LinkedHashMap<>();
        output.put("asOfUtc",today.toString());
        output.put("customers",count("SELECT count(*) FROM customers"));
        output.put("suppliers",count("SELECT count(*) FROM suppliers"));
        output.put("leadsActive",count("SELECT count(*) FROM crm_leads WHERE status IN ('NEW','CONTACTED','QUALIFIED')"));
        output.put("leadsWon",count("SELECT count(*) FROM crm_leads WHERE status='WON'"));
        output.put("rfqsOpen",count("SELECT count(*) FROM rfqs WHERE status <> 'CLOSED'"));
        output.put("salesOpen",count("SELECT count(*) FROM sales_orders WHERE status IN ('DRAFT','CONFIRMED','IN_PROGRESS')"));
        output.put("projectsActive",count("SELECT count(*) FROM business_projects WHERE status IN ('PLANNED','ACTIVE','ON_HOLD')"));
        output.put("projectsOverdue",count("""
            SELECT count(*) FROM business_projects
            WHERE due_date < ? AND status IN ('PLANNED','ACTIVE','ON_HOLD')
            """,today));
        output.put("shipmentsTransit",count("SELECT count(*) FROM shipments WHERE status='IN_TRANSIT'"));
        output.put("shipmentsLate",count("""
            SELECT count(*) FROM shipments
            WHERE eta < ? AND status IN ('BOOKED','IN_TRANSIT')
            """,today));
        output.put("tasksOverdue",count("""
            SELECT count(*) FROM work_tasks WHERE due_date < ? AND status <> 'DONE'
            """,today));
        output.put("invoicesOverdue",count("""
            SELECT count(*) FROM invoices
            WHERE due_date < ? AND status='ISSUED'
            """,today));
        List<Map<String,Object>> aging=db.queryForList("""
            SELECT i.currency,i.invoice_type,count(*) AS invoice_count,
                sum(i.amount-coalesce(payments.total,0)) AS outstanding
            FROM invoices i LEFT JOIN LATERAL (
                SELECT sum(p.amount) AS total FROM invoice_payments p WHERE p.invoice_id=i.id
            ) payments ON true WHERE i.status='ISSUED'
            GROUP BY i.currency,i.invoice_type
            HAVING sum(i.amount-coalesce(payments.total,0)) > 0
            ORDER BY i.currency,i.invoice_type
            """);
        output.put("outstandingByCurrency",aging);
        output.put("nextShipments",db.queryForList("""
            SELECT reference,origin,destination,eta,status
            FROM shipments WHERE status IN ('BOOKED','IN_TRANSIT')
            ORDER BY eta ASC NULLS LAST,created_at DESC LIMIT 6
            """));
        output.put("nextTasks",db.queryForList("""
            SELECT t.id,t.title,t.priority,t.due_date,t.status,u.username AS assignee
            FROM work_tasks t JOIN staff_users u ON u.id=t.assignee_id
            WHERE t.status <> 'DONE' ORDER BY t.due_date ASC NULLS LAST,t.created_at DESC LIMIT 6
            """));
        return output;
    }
}
