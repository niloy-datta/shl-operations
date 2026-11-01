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
@RequestMapping("/api/tasks")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE')")
public class TasksController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public TasksController(JdbcTemplate db,AuditService audit) { this.db=db;this.audit=audit; }
    public record TaskInput(@NotBlank @Size(max=180) String title,
        @Size(max=2000) String description,@NotNull UUID assigneeId,
        UUID rfqId,UUID salesOrderId,UUID shipmentId,LocalDate dueDate,
        @NotBlank String priority) {}
    public record StatusInput(@NotBlank String status) {}
    private Map<String,Object> getForUpdate(UUID id) {
        return db.queryForList("""
            SELECT t.*,u.username AS assignee_name FROM work_tasks t
            JOIN staff_users u ON u.id=t.assignee_id WHERE t.id=? FOR UPDATE OF t
            """,id).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND,"Task not found"));
    }
    private boolean manager() {
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return auth!=null && auth.getAuthorities().stream().anyMatch(a ->
            List.of("ROLE_ADMIN","ROLE_MANAGEMENT").contains(a.getAuthority()));
    }
    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size) {
        String where=manager()?"":" WHERE u.username=?";
        Object[] args=manager()?new Object[]{}:new Object[]{audit.actor()};
        return Pages.of(db,"t.*,u.username AS assignee_name",
            "FROM work_tasks t JOIN staff_users u ON u.id=t.assignee_id",where,args,
            "ORDER BY t.created_at DESC,t.id DESC",page,size);
    }
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody TaskInput input) {
        if (!List.of("LOW","NORMAL","HIGH").contains(input.priority()))
            throw new ResponseStatusException(BAD_REQUEST,"Invalid priority");
        long links=java.util.stream.Stream.of(input.rfqId(),input.salesOrderId(),input.shipmentId())
            .filter(Objects::nonNull).count();
        if (links>1) throw new ResponseStatusException(BAD_REQUEST,"Select at most one linked record");
        Boolean enabled=db.queryForObject("SELECT EXISTS(SELECT 1 FROM staff_users WHERE id=? AND enabled=true)",
            Boolean.class,input.assigneeId());
        if (!Boolean.TRUE.equals(enabled))
            throw new ResponseStatusException(BAD_REQUEST,"Assign to an active staff member");
        if (input.rfqId()!=null) requireExists("rfqs",input.rfqId());
        if (input.salesOrderId()!=null) requireExists("sales_orders",input.salesOrderId());
        if (input.shipmentId()!=null) requireExists("shipments",input.shipmentId());
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO work_tasks(id,title,description,assignee_id,rfq_id,sales_order_id,
                shipment_id,due_date,priority) VALUES(?,?,?,?,?,?,?,?,?)
            """,id,input.title().trim(),input.description(),input.assigneeId(),input.rfqId(),
            input.salesOrderId(),input.shipmentId(),input.dueDate(),input.priority());
        audit.log("CREATED","TASK",id,"Assigned to "+input.assigneeId());
        return ResponseEntity.created(URI.create("/api/tasks/"+id)).body(getForUpdate(id));
    }
    private void requireExists(String table,UUID id) {
        boolean exists=Boolean.TRUE.equals(db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM "+table+" WHERE id=?)",Boolean.class,id));
        if (!exists) throw new ResponseStatusException(BAD_REQUEST,"Linked record not found");
    }
    @PatchMapping("/{id}/status")
    @Transactional
    public Map<String,Object> status(@PathVariable UUID id,@Valid @RequestBody StatusInput input) {
        var task=getForUpdate(id);
        if (!manager() && !audit.actor().equals(task.get("assignee_name")))
            throw new ResponseStatusException(FORBIDDEN,"Not your assigned task");
        String before=(String)task.get("status"),next=input.status();
        boolean allowed=("TODO".equals(before) && "IN_PROGRESS".equals(next))
            || ("IN_PROGRESS".equals(before) && List.of("TODO","DONE").contains(next))
            || ("DONE".equals(before) && "IN_PROGRESS".equals(next) && manager());
        if (!allowed) throw new ResponseStatusException(CONFLICT,"Invalid task transition");
        db.update("UPDATE work_tasks SET status=?,updated_at=now() WHERE id=?",next,id);
        audit.log("STATUS_CHANGED","TASK",id,before+" -> "+next);
        return getForUpdate(id);
    }
}
