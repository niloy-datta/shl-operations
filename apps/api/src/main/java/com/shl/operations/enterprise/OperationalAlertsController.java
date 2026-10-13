package com.shl.operations.enterprise;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/** Role-scoped operational due dates; nothing is pushed to external messaging systems. */
@RestController
@RequestMapping("/api/alerts")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE')")
public class OperationalAlertsController {
    private final JdbcTemplate db;
    public OperationalAlertsController(JdbcTemplate db){this.db=db;}
    public record Alert(String source,String reference,String title,LocalDate dueDate,
        String urgency,String url) {}
    public record Feed(List<Alert> items,int overdue,int dueToday,int upcoming,String timezone) {}

    private String urgency(LocalDate date,LocalDate today){
        if(date.isBefore(today))return "OVERDUE";
        if(date.isEqual(today))return "DUE_TODAY";
        return "UPCOMING";
    }
    private boolean role(String authority){
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        return authentication!=null&&authentication.getAuthorities().stream()
            .anyMatch(a->authority.equals(a.getAuthority()));
    }
    private boolean anyRole(String...roles){
        return Arrays.stream(roles).anyMatch(x->role("ROLE_"+x));
    }
    @GetMapping
    public Feed feed(){
        LocalDate today=LocalDate.now(ZoneOffset.UTC),end=today.plusDays(7);
        String me=SecurityContextHolder.getContext().getAuthentication().getName();
        boolean manager=anyRole("ADMIN","MANAGEMENT");
        List<Alert> alerts=new ArrayList<>();

        // Personal tasks: ordinary staff only see assigned work; managers may see all.
        String tasks="""
            SELECT t.title,t.due_date,t.id FROM work_tasks t
            JOIN staff_users s ON s.id=t.assignee_id
            WHERE t.status <> 'DONE' AND t.due_date IS NOT NULL
              AND t.due_date <= ?
            """+(manager?"":" AND s.username=?")+
            " ORDER BY t.due_date ASC,t.id ASC LIMIT 60";
        Object[] args=manager?new Object[]{end}:new Object[]{end,me};
        alerts.addAll(db.query(tasks,(rs,i)->new Alert("TASK",
            rs.getObject("id").toString(),rs.getString("title"),
            rs.getObject("due_date",LocalDate.class),
            urgency(rs.getObject("due_date",LocalDate.class),today),
            "/workspace/enterprise/tasks"),args));

        if(anyRole("ADMIN","MANAGEMENT","BD")){
            String leads="""
                SELECT l.reference,l.subject,l.next_follow_up FROM crm_leads l
                LEFT JOIN staff_users s ON s.id=l.owner_id
                WHERE l.status NOT IN ('WON','LOST')
                  AND l.next_follow_up IS NOT NULL AND l.next_follow_up <= ?
                """+(manager?"":" AND s.username=?")+
                " ORDER BY l.next_follow_up ASC,l.id ASC LIMIT 40";
            alerts.addAll(db.query(leads,(rs,i)->{
                LocalDate date=rs.getObject("next_follow_up",LocalDate.class);
                return new Alert("LEAD",rs.getString("reference"),rs.getString("subject"),
                    date,urgency(date,today),"/workspace/growth/leads");
            },manager?new Object[]{end}:new Object[]{end,me}));
        }
        String projects="""
            SELECT p.reference,p.title,p.due_date FROM business_projects p
            JOIN staff_users s ON s.id=p.owner_id
            WHERE p.status IN ('PLANNED','ACTIVE','ON_HOLD')
              AND p.due_date IS NOT NULL AND p.due_date <= ?
            """+(manager?"":" AND s.username=?")+
            " ORDER BY p.due_date ASC,p.id ASC LIMIT 40";
        alerts.addAll(db.query(projects,(rs,i)->{
            LocalDate date=rs.getObject("due_date",LocalDate.class);
            return new Alert("PROJECT",rs.getString("reference"),rs.getString("title"),
                date,urgency(date,today),"/workspace/growth/projects");
        },manager?new Object[]{end}:new Object[]{end,me}));

        if(anyRole("ADMIN","MANAGEMENT","LOGISTICS","SOURCING")){
            alerts.addAll(db.query("""
                SELECT reference,eta FROM shipments
                WHERE status IN ('BOOKED','IN_TRANSIT')
                  AND eta IS NOT NULL AND eta <= ?
                ORDER BY eta,id LIMIT 40
                """,(rs,i)->{
                LocalDate date=rs.getObject("eta",LocalDate.class);
                return new Alert("SHIPMENT",rs.getString("reference"),
                    "Shipment estimated arrival",date,urgency(date,today),
                    "/workspace/enterprise/shipments");
            },end));
        }
        if(anyRole("ADMIN","MANAGEMENT","FINANCE")){
            alerts.addAll(db.query("""
                SELECT reference,due_date FROM invoices
                WHERE status='ISSUED' AND due_date IS NOT NULL AND due_date <= ?
                ORDER BY due_date,id LIMIT 40
                """,(rs,i)->{
                LocalDate date=rs.getObject("due_date",LocalDate.class);
                return new Alert("INVOICE",rs.getString("reference"),
                    "Payment due",date,urgency(date,today),
                    "/workspace/enterprise/invoices");
            },end));
        }
        alerts.sort(Comparator.comparing(Alert::dueDate)
            .thenComparing(Alert::source).thenComparing(Alert::reference));
        List<Alert> limited=alerts.stream().limit(100).toList();
        return new Feed(limited,
            (int)limited.stream().filter(x->"OVERDUE".equals(x.urgency())).count(),
            (int)limited.stream().filter(x->"DUE_TODAY".equals(x.urgency())).count(),
            (int)limited.stream().filter(x->"UPCOMING".equals(x.urgency())).count(),
            "UTC");
    }
}
