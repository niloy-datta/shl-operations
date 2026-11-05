package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/commerce/line-orders/purchase-orders/{poId}/production")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
public class PoProductionMilestonesController
{
    private static final Set<String> KINDS=Set.of(
        "PRODUCTION_START","FACTORY_READY","QUALITY_CHECK");
    private final JdbcTemplate db;
    private final AuditService audit;

    public PoProductionMilestonesController(JdbcTemplate db,AuditService audit)
    {
        this.db=db;
        this.audit=audit;
    }

    public record Create(
        @NotBlank String kind,
        @NotNull LocalDate targetDate,
        @NotBlank @Size(max=500) String notes)
    {
    }

    public record Change(
        @NotBlank String status,
        @NotBlank @Size(max=500) String note)
    {
    }

    private Map<String,Object> purchase(UUID poId,boolean lock)
    {
        return db.queryForList("SELECT id,status FROM line_purchase_orders WHERE id=?"+
            (lock?" FOR UPDATE":""),poId).stream().findFirst().orElseThrow(
                ()->new ResponseStatusException(NOT_FOUND,"Supplier PO not found"));
    }

    private Map<String,Object> milestone(UUID poId,UUID id,boolean lock)
    {
        return db.queryForList("""
            SELECT * FROM line_po_production_milestones
            WHERE purchase_order_id=? AND id=?
            """+(lock?" FOR UPDATE":""),poId,id).stream().findFirst().orElseThrow(
                ()->new ResponseStatusException(NOT_FOUND,"Milestone not found"));
    }

    private String kind(String raw)
    {
        String value=raw.trim().toUpperCase(Locale.ROOT);
        if(!KINDS.contains(value))
        {
            throw new ResponseStatusException(BAD_REQUEST,"Invalid factory milestone");
        }
        return value;
    }

    @GetMapping
    public List<Map<String,Object>> list(@PathVariable UUID poId)
    {
        purchase(poId,false);
        return db.queryForList("""
            SELECT id,purchase_order_id,kind,status,target_date,notes,
                   created_by,created_at,updated_at,completed_by,completed_at
            FROM line_po_production_milestones WHERE purchase_order_id=?
            ORDER BY CASE kind WHEN 'PRODUCTION_START' THEN 1
                       WHEN 'FACTORY_READY' THEN 2 ELSE 3 END
            """,poId);
    }

    @GetMapping("/{id}/events")
    public List<Map<String,Object>> events(@PathVariable UUID poId,@PathVariable UUID id)
    {
        milestone(poId,id,false);
        return db.queryForList("""
            SELECT id,event,note,actor,created_at
            FROM line_po_production_events WHERE milestone_id=?
            ORDER BY created_at ASC,id ASC LIMIT 100
            """,id);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@PathVariable UUID poId,
        @Valid @RequestBody Create input)
    {
        String type=kind(input.kind());
        var po=purchase(poId,true);
        if(!"ISSUED".equals(po.get("status")))
        {
            throw new ResponseStatusException(CONFLICT,
                "Factory milestones require an issued supplier PO");
        }
        if(input.targetDate().isBefore(LocalDate.now(ZoneOffset.UTC)))
        {
            throw new ResponseStatusException(BAD_REQUEST,
                "New milestone target date cannot be in the past");
        }
        if(!db.queryForList("""
            SELECT id FROM line_po_production_milestones
            WHERE purchase_order_id=? AND kind=?
            """,poId,type).isEmpty())
        {
            throw new ResponseStatusException(CONFLICT,
                "This milestone already exists");
        }
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO line_po_production_milestones
               (id,purchase_order_id,kind,target_date,notes,created_by)
            VALUES(?,?,?,?,?,?)
            """,id,poId,type,input.targetDate(),input.notes().trim(),audit.actor());
        record(id,"PLANNED",input.notes().trim());
        audit.log("FACTORY_MILESTONE_CREATED","LINE_PURCHASE_ORDER",poId,
            type+" milestone "+id);
        return ResponseEntity.created(URI.create(
            "/api/commerce/line-orders/purchase-orders/"+poId+"/production/"+id))
            .body(milestone(poId,id,false));
    }

    private void record(UUID milestoneId,String event,String note)
    {
        db.update("""
            INSERT INTO line_po_production_events(id,milestone_id,event,note,actor)
            VALUES(?,?,?,?,?)
            """,UUID.randomUUID(),milestoneId,event,note,audit.actor());
    }

    private void completed(UUID poId,String predecessor)
    {
        Boolean ready=db.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM line_po_production_milestones
                WHERE purchase_order_id=? AND kind=? AND status='COMPLETED')
            """,Boolean.class,poId,predecessor);
        if(!Boolean.TRUE.equals(ready))
        {
            throw new ResponseStatusException(CONFLICT,
                "Complete the preceding factory milestone first");
        }
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public Map<String,Object> status(@PathVariable UUID poId,@PathVariable UUID id,
        @Valid @RequestBody Change input)
    {
        purchase(poId,true);
        var before=milestone(poId,id,true);
        String current=(String)before.get("status");
        String next=input.status().trim().toUpperCase(Locale.ROOT);
        boolean valid=("PLANNED".equals(current) &&
                Set.of("IN_PROGRESS","BLOCKED").contains(next))
            || ("IN_PROGRESS".equals(current) &&
                Set.of("COMPLETED","BLOCKED").contains(next))
            || ("BLOCKED".equals(current) && "IN_PROGRESS".equals(next));
        if(!valid)
        {
            throw new ResponseStatusException(CONFLICT,"Invalid milestone transition");
        }
        String type=(String)before.get("kind");
        if("COMPLETED".equals(next))
        {
            if("FACTORY_READY".equals(type))
            {
                completed(poId,"PRODUCTION_START");
            }
            else if("QUALITY_CHECK".equals(type))
            {
                completed(poId,"FACTORY_READY");
                var role=org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication().getAuthorities().stream()
                    .map(a->a.getAuthority()).toList();
                if(!role.contains("ROLE_ADMIN") && !role.contains("ROLE_MANAGEMENT"))
                {
                    throw new ResponseStatusException(FORBIDDEN,
                        "Quality completion requires manager review");
                }
                if(audit.actor().equals(before.get("created_by")))
                {
                    throw new ResponseStatusException(CONFLICT,
                        "Quality review must be independently recorded");
                }
            }
            db.update("""
                UPDATE line_po_production_milestones
                SET status=?,completed_by=?,completed_at=clock_timestamp(),
                    updated_at=clock_timestamp() WHERE id=?
                """,next,audit.actor(),id);
        }
        else
        {
            db.update("""
                UPDATE line_po_production_milestones
                SET status=?,updated_at=clock_timestamp() WHERE id=?
                """,next,id);
        }
        record(id,next,input.note().trim());
        audit.log("FACTORY_MILESTONE_CHANGED","LINE_PURCHASE_ORDER",poId,
            type+" "+current+" -> "+next+" event "+id);
        return milestone(poId,id,false);
    }
}
