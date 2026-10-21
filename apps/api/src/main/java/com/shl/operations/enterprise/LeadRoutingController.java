package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Manager-approved routing of open leads to active BD staff. No external messaging. */
@RestController
@RequestMapping("/api/growth/leads")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD')")
public class LeadRoutingController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public LeadRoutingController(JdbcTemplate db, AuditService audit) {
        this.db=db;
        this.audit=audit;
    }
    public record AssignmentInput(@NotNull UUID ownerId,
        @NotBlank @Size(max=300) String reason) {}

    private Map<String,Object> lockedLead(UUID id) {
        return db.queryForList("""
            SELECT id,reference,owner_id,status FROM crm_leads WHERE id=? FOR UPDATE
            """,id).stream().findFirst().orElseThrow(
                () -> new ResponseStatusException(NOT_FOUND,"Lead not found"));
    }
    private void requireOpen(Map<String,Object> lead) {
        if(Set.of("WON","LOST").contains(lead.get("status")))
            throw new ResponseStatusException(CONFLICT,"Closed leads cannot be reassigned");
    }
    private UUID activeBd(UUID id) {
        Boolean valid=db.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM staff_users WHERE id=? AND enabled=true AND role='BD')
            """,Boolean.class,id);
        if(!Boolean.TRUE.equals(valid))
            throw new ResponseStatusException(BAD_REQUEST,"Owner must be an active BD staff member");
        return id;
    }
    private Map<String,Object> save(Map<String,Object> lead,UUID next,String reason) {
        UUID id=(UUID)lead.get("id"),previous=(UUID)lead.get("owner_id");
        if(Objects.equals(previous,next))
            throw new ResponseStatusException(CONFLICT,"Lead already has this owner");
        UUID eventId=UUID.randomUUID();
        db.update("UPDATE crm_leads SET owner_id=?,updated_at=now() WHERE id=?",next,id);
        db.update("""
            INSERT INTO crm_lead_assignments
                (id,lead_id,previous_owner_id,new_owner_id,assigned_by,reason)
            VALUES (?,?,?,?,?,?)
            """,eventId,id,previous,next,audit.actor(),reason);
        audit.log("OWNER_CHANGED","LEAD",id,"Owner assignment event "+eventId);
        return db.queryForMap("""
            SELECT l.id,l.reference,l.status,l.owner_id,u.username AS owner_name
            FROM crm_leads l JOIN staff_users u ON u.id=l.owner_id WHERE l.id=?
            """,id);
    }

    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    public Pages.Result queue(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size) {
        return Pages.of(db,"l.id,l.reference,l.company_name,l.subject,l.source,l.status,l.created_at",
            "FROM crm_leads l",
            " WHERE l.owner_id IS NULL AND l.status NOT IN ('WON','LOST')",
            new Object[]{},"ORDER BY l.created_at ASC,l.id ASC",page,size);
    }

    @GetMapping("/workload")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    public List<Map<String,Object>> workload() {
        return db.queryForList("""
            SELECT s.id,s.username,s.role,count(l.id) AS active_leads
            FROM staff_users s LEFT JOIN crm_leads l
                ON l.owner_id=s.id AND l.status NOT IN ('WON','LOST')
            WHERE s.enabled=true AND s.role='BD'
            GROUP BY s.id,s.username,s.role
            ORDER BY active_leads ASC,s.username ASC LIMIT 200
            """);
    }

    @GetMapping("/{id}/assignments")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    public List<Map<String,Object>> history(@PathVariable UUID id) {
        Boolean found=db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM crm_leads WHERE id=?)",Boolean.class,id);
        if(!Boolean.TRUE.equals(found))
            throw new ResponseStatusException(NOT_FOUND,"Lead not found");
        return db.queryForList("""
            SELECT a.id,a.lead_id,a.previous_owner_id,prev.username AS previous_owner_name,
                a.new_owner_id,nxt.username AS new_owner_name,a.assigned_by,a.reason,a.created_at
            FROM crm_lead_assignments a
            LEFT JOIN staff_users prev ON prev.id=a.previous_owner_id
            JOIN staff_users nxt ON nxt.id=a.new_owner_id
            WHERE a.lead_id=?
            ORDER BY a.created_at DESC,a.id DESC LIMIT 100
            """,id);
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public Map<String,Object> assign(@PathVariable UUID id,
        @Valid @RequestBody AssignmentInput input) {
        Map<String,Object> lead=lockedLead(id);
        requireOpen(lead);
        return save(lead,activeBd(input.ownerId()),input.reason().trim());
    }

    @PostMapping("/queue/assign-next")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public ResponseEntity<Map<String,Object>> assignNext() {
        // Serializes least-loaded calculations across concurrent assign-next requests.
        db.queryForList("SELECT pg_advisory_xact_lock(?)",701231401L);
        Map<String,Object> lead=db.queryForList("""
            SELECT id,reference,owner_id,status FROM crm_leads
            WHERE owner_id IS NULL AND status NOT IN ('WON','LOST')
            ORDER BY created_at ASC,id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
            """).stream().findFirst().orElseThrow(
                () -> new ResponseStatusException(CONFLICT,"No unassigned open leads"));
        List<Map<String,Object>> owners=workload();
        if(owners.isEmpty())
            throw new ResponseStatusException(CONFLICT,"No active BD staff to assign");
        UUID next=(UUID)owners.getFirst().get("id");
        Map<String,Object> assigned=save(lead,next,"Manager-approved least-loaded queue assignment");
        return ResponseEntity.created(URI.create("/api/growth/leads/"+lead.get("id")))
            .body(assigned);
    }
}
