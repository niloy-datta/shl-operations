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
@RequestMapping("/api/costs/expenses")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','FINANCE')")
public class ExpenseController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public ExpenseController(JdbcTemplate db,AuditService audit){this.db=db;this.audit=audit;}
    private static final Set<String> CATEGORIES=Set.of(
        "FREIGHT","CUSTOMS","PACKAGING","BANK_FEES","OPERATIONS","OTHER");
    public record Input(@NotNull UUID projectId,@NotBlank String category,
        @NotBlank @Size(max=300) String description,
        @NotNull @DecimalMin("0.01") @Digits(integer=18,fraction=2) BigDecimal amount,
        @NotBlank @Pattern(regexp="[A-Z]{3}") String currency,
        @NotNull LocalDate incurredOn) {}
    public record Status(@NotBlank String status) {}

    private Map<String,Object> row(String sql,Object...args){
        return db.queryForList(sql,args).stream().findFirst().orElseThrow(
            ()->new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private void require(boolean ok,String error){
        if(!ok)throw new ResponseStatusException(CONFLICT,error);
    }
    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        String term=q==null?"":q.trim().toLowerCase(Locale.ROOT);
        term=term.substring(0,Math.min(100,term.length()));
        return Pages.of(db,"e.*,p.reference AS project_reference,p.title AS project_title",
            "FROM project_expenses e JOIN business_projects p ON p.id=e.project_id",
            " WHERE (lower(e.reference) LIKE ? OR lower(p.title) LIKE ?)",
            new Object[]{"%"+term+"%","%"+term+"%"},
            "ORDER BY e.created_at DESC,e.id DESC",page,size);
    }
    @GetMapping("/{id}")
    public Map<String,Object> get(@PathVariable UUID id){
        return row("SELECT * FROM project_expenses WHERE id=?",id);
    }
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','FINANCE')")
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody Input input){
        require(CATEGORIES.contains(input.category()),"Unknown expense category");
        var project=row("SELECT * FROM business_projects WHERE id=? FOR UPDATE",input.projectId());
        require(!"CANCELLED".equals(project.get("status")),"Cancelled project");
        if(project.get("sales_order_id")!=null){
            var order=row("SELECT currency FROM sales_orders WHERE id=?",project.get("sales_order_id"));
            require(input.currency().equals(((String)order.get("currency")).trim()),
                "Expense currency must match linked order; FX conversion is not supported");
        }
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO project_expenses(id,reference,project_id,category,description,amount,
                currency,incurred_on,created_by)
            VALUES(?,?,?,?,?,?,?,?,?)
            """,id,"EXP-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT),
            input.projectId(),input.category(),input.description().trim(),input.amount(),
            input.currency(),input.incurredOn(),audit.actor());
        audit.log("CREATED","PROJECT_EXPENSE",id,"Expense captured for project "+input.projectId());
        return ResponseEntity.created(URI.create("/api/costs/expenses/"+id)).body(get(id));
    }
    @PatchMapping("/{id}/status")
    @Transactional
    public Map<String,Object> status(@PathVariable UUID id,@Valid @RequestBody Status input){
        var expense=row("SELECT * FROM project_expenses WHERE id=? FOR UPDATE",id);
        String old=(String)expense.get("status"),next=input.status();
        require("DRAFT".equals(old)&&Set.of("APPROVED","VOID").contains(next),
            "Only draft expenses can be approved or voided");
        if("APPROVED".equals(next))
            require(!audit.actor().equals(expense.get("created_by")),
                "Expense creator cannot approve their own expense");
        db.update("UPDATE project_expenses SET status=?,approved_by=?,updated_at=now() WHERE id=?",
            next,"APPROVED".equals(next)?audit.actor():null,id);
        audit.log("STATUS_CHANGED","PROJECT_EXPENSE",id,old+" -> "+next);
        return get(id);
    }
    @GetMapping("/summary")
    public List<Map<String,Object>> summary(){
        // No unverified currency conversion: sums remain separated by ISO currency.
        return db.queryForList("""
            SELECT currency,
              coalesce(sum(amount) FILTER(WHERE status='APPROVED'),0) AS approved,
              coalesce(sum(amount) FILTER(WHERE status='DRAFT'),0) AS pending,
              count(*) AS records
            FROM project_expenses GROUP BY currency ORDER BY currency
            """);
    }
}
