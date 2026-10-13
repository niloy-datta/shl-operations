package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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
@RequestMapping("/api/growth")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE')")
public class GrowthController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public GrowthController(JdbcTemplate db,AuditService audit) {this.db=db;this.audit=audit;}

    public record LeadInput(
        UUID customerId,
        @NotBlank @Size(max=180) String companyName,
        @NotBlank @Size(max=120) String contactName,
        @Email @Size(max=240) String contactEmail,
        @NotBlank String source,
        @NotBlank @Size(max=180) String subject,
        @Size(max=2000) String description,
        UUID ownerId, LocalDate nextFollowUp) {}
    public record ProjectInput(@NotNull UUID customerId,UUID leadId,UUID salesOrderId,
        @NotBlank @Size(max=180) String title, @Size(max=2000) String description,
        @NotNull UUID ownerId, LocalDate dueDate) {}
    public record ChangeStatus(@NotBlank String status) {}
    public record NoteInput(@NotBlank @Size(max=2000) String note) {}

    private static final Set<String> SOURCES=Set.of(
        "WEBSITE","EMAIL","WECHAT","REFERRAL","MANUAL","OTHER");
    private Map<String,Object> row(String sql,Object...args) {
        return db.queryForList(sql,args).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private void require(boolean condition,String message) {
        if(!condition) throw new ResponseStatusException(CONFLICT,message);
    }
    private String reference(String prefix,UUID id) {
        return prefix+"-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT);
    }
    private String clean(String value) {
        return value==null?null:value.trim();
    }
    private void validOwner(UUID id) {
        if(id==null) return;
        Boolean valid=db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM staff_users WHERE id=? AND enabled=true)",Boolean.class,id);
        require(Boolean.TRUE.equals(valid),"Assign to an active staff member");
    }
    @GetMapping("/leads")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    public Pages.Result leads(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        String term=clean(q).toLowerCase(Locale.ROOT);
        term=term.substring(0,Math.min(term.length(),100));
        return Pages.of(db,"l.*,u.username AS owner_name,c.name AS customer_name",
            "FROM crm_leads l LEFT JOIN staff_users u ON u.id=l.owner_id "+
                "LEFT JOIN customers c ON c.id=l.customer_id",
            " WHERE (lower(l.company_name) LIKE ? OR lower(l.subject) LIKE ?)",
            new Object[]{"%"+term+"%","%"+term+"%"},
            "ORDER BY l.created_at DESC,l.id DESC",page,size);
    }
    @GetMapping("/leads/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    public Map<String,Object> lead(@PathVariable UUID id) {
        return row("SELECT * FROM crm_leads WHERE id=?",id);
    }
    @PostMapping("/leads")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public ResponseEntity<Map<String,Object>> addLead(@Valid @RequestBody LeadInput input) {
        require(SOURCES.contains(input.source()),"Unsupported lead source");
        validOwner(input.ownerId());
        if(input.customerId()!=null)
            row("SELECT id FROM customers WHERE id=?",input.customerId());
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO crm_leads(id,reference,customer_id,company_name,contact_name,
              contact_email,source,subject,description,owner_id,next_follow_up,created_by)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """,id,reference("LEAD",id),input.customerId(),clean(input.companyName()),
            clean(input.contactName()),clean(input.contactEmail()),input.source(),clean(input.subject()),
            clean(input.description()),input.ownerId(),input.nextFollowUp(),audit.actor());
        audit.log("CREATED","LEAD",id,input.subject());
        return ResponseEntity.created(URI.create("/api/growth/leads/"+id)).body(lead(id));
    }
    @PatchMapping("/leads/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public Map<String,Object> leadStatus(@PathVariable UUID id,@Valid @RequestBody ChangeStatus input) {
        var existing=row("SELECT * FROM crm_leads WHERE id=? FOR UPDATE",id);
        String old=(String)existing.get("status"), next=input.status();
        Map<String,Set<String>> steps=Map.of(
            "NEW",Set.of("CONTACTED","QUALIFIED","LOST"),
            "CONTACTED",Set.of("QUALIFIED","LOST"),
            "QUALIFIED",Set.of("WON","LOST"));
        require(steps.getOrDefault(old,Set.of()).contains(next),"Invalid lead stage transition");
        db.update("UPDATE crm_leads SET status=?,updated_at=now() WHERE id=?",next,id);
        audit.log("STATUS_CHANGED","LEAD",id,old+" -> "+next);
        return lead(id);
    }

    @GetMapping("/projects")
    public Pages.Result projects(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        String term=clean(q).toLowerCase(Locale.ROOT);
        term=term.substring(0,Math.min(term.length(),100));
        return Pages.of(db,"p.*,c.name AS customer_name,u.username AS owner_name",
            "FROM business_projects p JOIN customers c ON c.id=p.customer_id "+
                "JOIN staff_users u ON u.id=p.owner_id",
            " WHERE (lower(p.title) LIKE ? OR lower(p.reference) LIKE ?)",
            new Object[]{"%"+term+"%","%"+term+"%"},
            "ORDER BY p.created_at DESC,p.id DESC",page,size);
    }
    @GetMapping("/projects/{id}")
    public Map<String,Object> project(@PathVariable UUID id) {
        return row("SELECT * FROM business_projects WHERE id=?",id);
    }
    @PostMapping("/projects")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public ResponseEntity<Map<String,Object>> addProject(@Valid @RequestBody ProjectInput input) {
        row("SELECT id FROM customers WHERE id=?",input.customerId());
        validOwner(input.ownerId());
        if(input.leadId()!=null) {
            var lead=row("SELECT * FROM crm_leads WHERE id=? FOR UPDATE",input.leadId());
            require("WON".equals(lead.get("status")),"Lead must be marked WON");
            if(lead.get("customer_id")!=null)
                require(input.customerId().equals(lead.get("customer_id")),
                    "Lead and project customers must match");
        }
        if(input.salesOrderId()!=null) {
            var order=row("SELECT * FROM sales_orders WHERE id=?",input.salesOrderId());
            require(input.customerId().equals(order.get("customer_id")),
                "Sales order and project customers must match");
            require(List.of("CONFIRMED","IN_PROGRESS","COMPLETED").contains(order.get("status")),
                "Sales order must be confirmed");
        }
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO business_projects(id,reference,customer_id,lead_id,sales_order_id,
              title,description,owner_id,due_date,created_by)
            VALUES(?,?,?,?,?,?,?,?,?,?)
            """,id,reference("JOB",id),input.customerId(),input.leadId(),
            input.salesOrderId(),clean(input.title()),clean(input.description()),
            input.ownerId(),input.dueDate(),audit.actor());
        audit.log("CREATED","PROJECT",id,reference("JOB",id));
        return ResponseEntity.created(URI.create("/api/growth/projects/"+id)).body(project(id));
    }
    @PatchMapping("/projects/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
    @Transactional
    public Map<String,Object> projectStatus(@PathVariable UUID id,
        @Valid @RequestBody ChangeStatus input) {
        var item=row("SELECT * FROM business_projects WHERE id=? FOR UPDATE",id);
        String old=(String)item.get("status"), next=input.status();
        Map<String,Set<String>> steps=Map.of(
            "PLANNED",Set.of("ACTIVE","CANCELLED"),
            "ACTIVE",Set.of("ON_HOLD","COMPLETED","CANCELLED"),
            "ON_HOLD",Set.of("ACTIVE","CANCELLED"));
        require(steps.getOrDefault(old,Set.of()).contains(next),
            "Invalid project state transition");
        if("COMPLETED".equals(next)&&item.get("sales_order_id")!=null) {
            var order=row("SELECT status FROM sales_orders WHERE id=?",item.get("sales_order_id"));
            require("COMPLETED".equals(order.get("status")),
                "Complete linked sales order before closing the project");
        }
        db.update("UPDATE business_projects SET status=?,updated_at=now() WHERE id=?",next,id);
        audit.log("STATUS_CHANGED","PROJECT",id,old+" -> "+next);
        return project(id);
    }
    @GetMapping("/projects/{id}/notes")
    public List<Map<String,Object>> notes(@PathVariable UUID id) {
        project(id);
        return db.queryForList("""
            SELECT id,author,note,created_at FROM project_notes
            WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 100
            """,id);
    }
    @PostMapping("/projects/{id}/notes")
    @Transactional
    public Map<String,Object> note(@PathVariable UUID id,@Valid @RequestBody NoteInput input) {
        project(id);
        UUID noteId=UUID.randomUUID();
        db.update("INSERT INTO project_notes(id,project_id,author,note) VALUES(?,?,?,?)",
            noteId,id,audit.actor(),clean(input.note()));
        audit.log("NOTE_ADDED","PROJECT",id,"Note "+noteId);
        return row("SELECT id,author,note,created_at FROM project_notes WHERE id=?",noteId);
    }
}
