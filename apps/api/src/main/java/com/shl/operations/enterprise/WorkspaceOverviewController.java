package com.shl.operations.enterprise;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.FORBIDDEN;

/** Nonfinancial operational projection; never exposes prices, margins or commissions. */
@RestController
@RequestMapping("/api/workspace/overview")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE')")
public class WorkspaceOverviewController {
    private final JdbcTemplate db;
    private final OperationalAlertsController alerts;
    public WorkspaceOverviewController(JdbcTemplate db, OperationalAlertsController alerts) {this.db=db;this.alerts=alerts;}
    public record Metric(String key,String label,long value,String href) {}
    public record Item(String id,String reference,String title,String context,String status,String owner,
        LocalDate dueDate,String url,String stage) {}
    public record Stage(String key,String label,long count,String href) {}
    private long count(String sql,Object...args){return Objects.requireNonNullElse(db.queryForObject(sql,Long.class,args),0L);}
    private List<Item> rows(String sql,String stage,Object...args){
        return db.query(sql,(r,i)->new Item(r.getString("id"),r.getString("reference"),r.getString("title"),
            r.getString("context"),r.getString("status"),r.getString("owner"),r.getObject("due_date",LocalDate.class),r.getString("url"),stage),args);
    }
    @GetMapping
    public Map<String,Object> overview(@RequestParam(defaultValue="personal") String scope){
        var auth=SecurityContextHolder.getContext().getAuthentication();String me=auth.getName();
        var roles=auth.getAuthorities().stream().map(a->a.getAuthority()).toList();
        boolean manager=roles.contains("ROLE_ADMIN")||roles.contains("ROLE_MANAGEMENT");
        boolean commercial=manager||roles.contains("ROLE_BD")||roles.contains("ROLE_SOURCING");
        boolean leads=manager||roles.contains("ROLE_BD");
        boolean shipping=manager||roles.contains("ROLE_SOURCING")||roles.contains("ROLE_LOGISTICS");
        boolean finance=manager||roles.contains("ROLE_FINANCE");
        if(!Set.of("personal","team").contains(scope))throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Invalid scope");
        if("team".equals(scope)&&!manager)throw new ResponseStatusException(FORBIDDEN,"Management scope required");
        boolean team=manager&&"team".equals(scope);LocalDate today=LocalDate.now(ZoneOffset.UTC);
        List<Metric> metrics=new ArrayList<>();List<Item> work=new ArrayList<>();List<Stage> pipeline=new ArrayList<>();
        Object[] taskArgs=team?new Object[]{}:new Object[]{me};String taskWhere=team?"":" AND u.username=?";
        long tasks=count("SELECT count(*) FROM work_tasks t JOIN staff_users u ON u.id=t.assignee_id WHERE t.status<>'DONE'"+taskWhere,taskArgs);
        metrics.add(new Metric("tasks",team?"Open team tasks":"My open tasks",tasks,"/workspace/enterprise/tasks"));
        work.addAll(rows("SELECT t.id::text,t.id::text AS reference,t.title,'Task' AS context,t.status,u.username AS owner,t.due_date,'/workspace/enterprise/tasks' AS url FROM work_tasks t JOIN staff_users u ON u.id=t.assignee_id WHERE t.status<>'DONE'"+taskWhere+" ORDER BY t.due_date ASC NULLS LAST,t.created_at DESC LIMIT 12","tasks",taskArgs));
        if(leads){
            String own=team?"":" AND u.username=?";
            long active=count("SELECT count(*) FROM crm_leads l LEFT JOIN staff_users u ON u.id=l.owner_id WHERE l.status NOT IN ('WON','LOST')"+own,taskArgs);
            metrics.add(new Metric("inquiries",team?"Active leads":"My active leads",active,"/workspace/growth/leads"));
            work.addAll(rows("SELECT l.id::text,l.reference,l.subject AS title,l.company_name AS context,l.status,coalesce(u.username,'Unassigned') AS owner,l.next_follow_up AS due_date,'/workspace/growth/leads?leadId='||l.id AS url FROM crm_leads l LEFT JOIN staff_users u ON u.id=l.owner_id WHERE l.status NOT IN ('WON','LOST')"+own+" ORDER BY l.next_follow_up ASC NULLS LAST,l.created_at DESC LIMIT 12","inquiry",taskArgs));
            pipeline.add(new Stage("inquiry","Inquiries",active,"/workspace/growth/leads"));
        }
        if(commercial){
            long open=count("SELECT count(*) FROM rfqs WHERE status<>'CLOSED'");
            metrics.add(new Metric("rfqs","Open RFQs",open,"/workspace/rfqs"));
            for(var stage:List.of(new String[]{"NEW","RFQs"},new String[]{"SOURCING","Supplier comparison"},new String[]{"READY_FOR_QUOTE","Quotation ready"}))
                pipeline.add(new Stage(stage[0],stage[1],count("SELECT count(*) FROM rfqs WHERE status=?",stage[0]),"/workspace/rfqs"));
            work.addAll(rows("SELECT r.id::text,r.reference,r.subject AS title,c.name AS context,r.status,'Sourcing desk' AS owner,r.deadline AS due_date,'/workspace/rfqs?rfqId='||r.id AS url FROM rfqs r JOIN customers c ON c.id=r.customer_id WHERE r.status<>'CLOSED' ORDER BY r.deadline ASC NULLS LAST,r.created_at DESC LIMIT 12","rfq"));
            pipeline.add(new Stage("order","Line orders",count("SELECT count(*) FROM line_sales_orders WHERE status='CONFIRMED'"),"/workspace/rfqs"));
        }
        List<Item> approvals=new ArrayList<>(manager?rows("SELECT q.id::text,'QUOTE V'||q.version AS reference,r.subject AS title,c.name AS context,q.status,q.created_by AS owner,q.valid_until AS due_date,'/workspace/enterprise/line-quotes?rfqId='||q.rfq_id AS url FROM customer_line_quotes q JOIN rfqs r ON r.id=q.rfq_id JOIN customers c ON c.id=r.customer_id WHERE q.status='SUBMITTED' AND q.created_by<>? ORDER BY q.created_at LIMIT 12","approval",me):List.of());
        if(manager)approvals.addAll(rows("SELECT so.id::text,so.reference,'Review sales order' AS title,c.name AS context,so.status,so.created_by AS owner,NULL::date AS due_date,'/workspace/enterprise/line-quotes?rfqId='||so.rfq_id AS url FROM line_sales_orders so JOIN customers c ON c.id=so.customer_id WHERE so.status='DRAFT' AND so.created_by<>? ORDER BY so.created_at LIMIT 4","approval",me));
        if(manager||roles.contains("ROLE_SOURCING"))approvals.addAll(rows("SELECT po.id::text,po.reference,'Review supplier PO before issue' AS title,s.name AS context,po.status,po.created_by AS owner,NULL::date AS due_date,'/workspace/enterprise/line-quotes?rfqId='||so.rfq_id AS url FROM line_purchase_orders po JOIN line_sales_orders so ON so.id=po.sales_order_id JOIN suppliers s ON s.id=po.supplier_id WHERE po.status='DRAFT' AND po.created_by<>? ORDER BY po.created_at LIMIT 4","approval",me));
        if(manager)metrics.add(new Metric("approvals","Awaiting my review",count("SELECT (SELECT count(*) FROM customer_line_quotes WHERE status='SUBMITTED' AND created_by<>?)+(SELECT count(*) FROM line_sales_orders WHERE status='DRAFT' AND created_by<>?)+(SELECT count(*) FROM line_purchase_orders WHERE status='DRAFT' AND created_by<>?)",me,me,me),"/workspace/command-center"));
        List<Item> shipments=shipping?rows("SELECT sh.id::text,sh.reference,sh.origin||' → '||sh.destination AS title,s.name AS context,sh.status,'Logistics desk' AS owner,sh.eta AS due_date,'/workspace/shipments/line?shipmentId='||sh.id AS url FROM line_shipments sh JOIN line_purchase_orders po ON po.id=sh.purchase_order_id JOIN suppliers s ON s.id=po.supplier_id WHERE sh.status IN ('BOOKED','IN_TRANSIT') ORDER BY sh.eta ASC NULLS LAST,sh.created_at DESC LIMIT 8","shipment"):List.of();
        Map<String,Object> logistics=Map.of();
        if(shipping){
            long transit=count("SELECT count(*) FROM line_shipments WHERE status IN ('BOOKED','IN_TRANSIT')");
            if(metrics.size()<4)metrics.add(new Metric("shipments","Active line shipments",transit,"/workspace/shipments/line"));
            pipeline.add(new Stage("shipment","Shipment",transit,"/workspace/shipments/line"));
            pipeline.add(new Stage("delivery","Staff-reported delivery",count("SELECT count(*) FROM line_shipments WHERE status='DELIVERED'"),"/workspace/shipments/line"));
            long delayed=count("SELECT count(*) FROM line_shipments WHERE status IN ('BOOKED','IN_TRANSIT') AND eta<?",today);
            long missingEta=count("SELECT count(*) FROM line_shipments WHERE status IN ('BOOKED','IN_TRANSIT') AND eta IS NULL");
            long openExceptions=count("SELECT count(*) FROM line_shipment_exceptions WHERE status='OPEN'");
            List<Item> exceptionItems=rows("SELECT e.id::text,sh.reference,e.type AS title,s.name AS context,e.status,e.opened_by AS owner,e.review_due AS due_date,'/workspace/shipments/line?shipmentId='||sh.id AS url FROM line_shipment_exceptions e JOIN line_shipments sh ON sh.id=e.shipment_id JOIN line_purchase_orders po ON po.id=sh.purchase_order_id JOIN suppliers s ON s.id=po.supplier_id WHERE e.status='OPEN' ORDER BY e.review_due ASC NULLS LAST,e.created_at DESC LIMIT 4","exception");
            logistics=Map.of("active",transit,"delayed",delayed,"missingEta",missingEta,"openExceptions",openExceptions,"exceptions",exceptionItems);
        }
        if(finance)pipeline.add(new Stage("billing","Unposted billing review",count("SELECT count(*) FROM line_billing_candidates WHERE status<>'VOID'"),"/workspace/finance/line-billing"));
        work.sort(Comparator.comparing(Item::dueDate,Comparator.nullsLast(Comparator.naturalOrder())));
        Map<String,Object> result=new LinkedHashMap<>();result.put("asOfUtc",today);result.put("scope",scope);
        result.put("metrics",metrics.stream().limit(4).toList());result.put("priorities",work.stream().limit(16).toList());
        result.put("orders",commercial?rows("SELECT so.id::text,so.reference,'Line sales order' AS title,c.name AS context,so.status,so.created_by AS owner,NULL::date AS due_date,'/workspace/enterprise/line-quotes?rfqId='||so.rfq_id AS url FROM line_sales_orders so JOIN customers c ON c.id=so.customer_id WHERE so.status IN ('DRAFT','CONFIRMED') ORDER BY so.created_at DESC LIMIT 8","order"):List.of());
        result.put("workload",team?db.queryForList("SELECT u.username,count(*) AS open_tasks FROM work_tasks t JOIN staff_users u ON u.id=t.assignee_id WHERE t.status<>'DONE' GROUP BY u.username ORDER BY count(*) DESC,u.username LIMIT 8"):List.of());
        result.put("activity",rows("SELECT t.id::text,t.id::text AS reference,t.title,'Task updated' AS context,t.status,u.username AS owner,t.updated_at::date AS due_date,'/workspace/enterprise/tasks' AS url FROM work_tasks t JOIN staff_users u ON u.id=t.assignee_id WHERE true"+taskWhere+" ORDER BY t.updated_at DESC LIMIT 6","tasks",taskArgs));
        result.put("approvals",approvals);result.put("shipments",shipments);result.put("pipeline",pipeline);result.put("alerts",alerts.feed());
        result.put("logistics",logistics);
        result.put("offices",team?db.queryForList("SELECT reference,legal_name AS name,country_code AS \"countryCode\",city FROM business_entities WHERE kind='OFFICE' AND status='ACTIVE' ORDER BY legal_name LIMIT 8"):List.of());
        return result;
    }
}
