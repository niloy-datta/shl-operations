package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/**
 * Separate confidential data boundary. ADMIN and MANAGEMENT do not imply access.
 * Exact staff usernames must be explicitly provisioned via protected deployment configuration.
 */
@RestController
@RequestMapping("/api/costs/commissions")
@PreAuthorize("isAuthenticated()")
public class ConfidentialCommissionController {
    private final JdbcTemplate db;
    private final AuditService audit;
    private final Set<String> authorized;
    private static final Set<String> TYPES=Set.of("STAFF","CNEE","KEY_PERSON","OTHER");

    public ConfidentialCommissionController(JdbcTemplate db,AuditService audit,
        @Value("${COMMISSION_AUTHORIZED_USERS:}") String members){
        this.db=db;this.audit=audit;
        Set<String> names=new HashSet<>();
        for(String member:members.split(",")){
            String normalized=member.trim().toLowerCase(Locale.ROOT);
            if(!normalized.isBlank())names.add(normalized);
        }
        this.authorized=Set.copyOf(names);
    }
    public record Input(
        @NotNull UUID projectId,@NotBlank String beneficiaryType,
        @NotBlank @Size(max=160) String beneficiary,
        @NotNull @DecimalMin("0.01") @Digits(integer=18,fraction=2) BigDecimal basisAmount,
        @NotNull @DecimalMin("0.0001") @DecimalMax("100.0000")
            @Digits(integer=3,fraction=4) BigDecimal ratePercent,
        @NotBlank @Pattern(regexp="[A-Z]{3}") String currency) {}
    public record Status(@NotBlank String status) {}

    private void requireAccess(){
        if(!authorized.contains(audit.actor().toLowerCase(Locale.ROOT)))
            throw new ResponseStatusException(FORBIDDEN,"Explicit commission authorization required");
    }
    private void require(boolean check,String message){
        if(!check)throw new ResponseStatusException(CONFLICT,message);
    }
    private Map<String,Object> row(String sql,Object...args){
        return db.queryForList(sql,args).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(NOT_FOUND,"Record not found"));
    }
    private void privateAudit(UUID commissionId,String action,String detail){
        db.update("""
            INSERT INTO confidential_commission_events(id,commission_id,actor,action,detail)
            VALUES(?,?,?,?,?)
            """,UUID.randomUUID(),commissionId,audit.actor(),action,detail);
    }
    @GetMapping("/access")
    public Map<String,Boolean> access(){
        return Map.of("allowed",authorized.contains(audit.actor().toLowerCase(Locale.ROOT)));
    }
    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        requireAccess();
        String term=q==null?"":q.trim().toLowerCase(Locale.ROOT);
        term=term.substring(0,Math.min(100,term.length()));
        return Pages.of(db,
            "c.*,p.reference AS project_reference",
            "FROM confidential_commissions c JOIN business_projects p ON p.id=c.project_id",
            " WHERE (lower(c.reference) LIKE ? OR lower(c.beneficiary) LIKE ?)",
            new Object[]{"%"+term+"%","%"+term+"%"},
            "ORDER BY c.created_at DESC,c.id DESC",page,size);
    }
    @GetMapping("/{id}")
    public Map<String,Object> get(@PathVariable UUID id){
        requireAccess();
        return row("SELECT * FROM confidential_commissions WHERE id=?",id);
    }
    @GetMapping("/{id}/history")
    public List<Map<String,Object>> history(@PathVariable UUID id){
        requireAccess();get(id);
        return db.queryForList("""
            SELECT actor,action,detail,created_at FROM confidential_commission_events
            WHERE commission_id=? ORDER BY created_at DESC,id DESC LIMIT 100
            """,id);
    }
    @PostMapping
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody Input input){
        requireAccess();
        require(TYPES.contains(input.beneficiaryType()),"Invalid beneficiary category");
        var project=row("SELECT * FROM business_projects WHERE id=? FOR UPDATE",input.projectId());
        require(!"CANCELLED".equals(project.get("status")),"Project is cancelled");
        if(project.get("sales_order_id")!=null){
            var order=row("SELECT currency FROM sales_orders WHERE id=?",project.get("sales_order_id"));
            require(input.currency().equals(((String)order.get("currency")).trim()),
                "Commission currency must match linked order");
        }
        BigDecimal amount=input.basisAmount().multiply(input.ratePercent())
            .divide(new BigDecimal("100"),2,RoundingMode.HALF_UP);
        require(amount.signum()>0,"Calculated commission must be positive");
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO confidential_commissions
              (id,reference,project_id,beneficiary_type,beneficiary,basis_amount,rate_percent,
                 commission_amount,currency,created_by)
            VALUES(?,?,?,?,?,?,?,?,?,?)
            """,id,"COM-"+id.toString().substring(0,12).toUpperCase(Locale.ROOT),
            input.projectId(),input.beneficiaryType(),input.beneficiary().trim(),
            input.basisAmount(),input.ratePercent(),amount,input.currency(),audit.actor());
        privateAudit(id,"CREATED","Restricted commission proposal");
        return ResponseEntity.created(URI.create("/api/costs/commissions/"+id)).body(get(id));
    }
    @PatchMapping("/{id}/status")
    @Transactional
    public Map<String,Object> status(@PathVariable UUID id,@Valid @RequestBody Status input){
        requireAccess();
        var commission=row("SELECT * FROM confidential_commissions WHERE id=? FOR UPDATE",id);
        String current=(String)commission.get("status"),next=input.status();
        require("DRAFT".equals(current)&&Set.of("APPROVED","CANCELLED").contains(next),
            "Invalid commission status transition");
        if("APPROVED".equals(next))
            require(!audit.actor().equals(commission.get("created_by")),
                "Commission creator cannot approve their own commission");
        db.update("""
            UPDATE confidential_commissions
            SET status=?,approved_by=?,updated_at=now() WHERE id=?
            """,next,"APPROVED".equals(next)?audit.actor():null,id);
        privateAudit(id,"STATUS_CHANGED",current+" -> "+next);
        return get(id);
    }
}
