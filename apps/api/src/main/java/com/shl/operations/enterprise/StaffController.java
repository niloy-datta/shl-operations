package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/staff")
public class StaffController {
    private final JdbcTemplate db;
    private final AuditService audit;
    private static final Set<String> ROLES=Set.of("ADMIN","MANAGEMENT","BD","SOURCING","LOGISTICS","FINANCE");
    public StaffController(JdbcTemplate db, AuditService audit) { this.db=db; this.audit=audit; }
    public record NewStaff(@NotBlank @Pattern(regexp="[A-Za-z0-9._-]{3,80}") String username,
        @NotNull UUID supabaseUserId, @NotBlank String role) {}
    public record ChangeAccess(@NotBlank String role, boolean enabled) {}
    private void role(String name) {
        if(!ROLES.contains(name))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid staff role");
    }
    @GetMapping("/options") public List<Map<String,Object>> options() {
        return db.queryForList("SELECT id,username,role FROM staff_users WHERE enabled=true ORDER BY username LIMIT 200");
    }
    @GetMapping @PreAuthorize("hasRole('ADMIN')") public Pages.Result list(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size) {
        return Pages.of(db,"id,username,role,enabled,supabase_user_id,mfa_required,created_at",
            "FROM staff_users","",new Object[]{},"ORDER BY created_at DESC,id DESC",page,size);
    }
    @PostMapping @PreAuthorize("hasRole('ADMIN')") @Transactional @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> create(@Valid @RequestBody NewStaff input) {
        role(input.role()); UUID id=UUID.randomUUID();
        db.update("INSERT INTO staff_users(id,username,role,enabled,supabase_user_id,mfa_required) VALUES(?,?,?,true,?,true)",
            id,input.username().trim(),input.role(),input.supabaseUserId());
        audit.log("CREATED","STAFF",id,"Supabase identity linked with role "+input.role());
        return db.queryForMap("SELECT id,username,role,enabled,supabase_user_id,mfa_required,created_at FROM staff_users WHERE id=?",id);
    }
    @PatchMapping("/{id}/access") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public Map<String,Object> changeAccess(@PathVariable UUID id,@Valid @RequestBody ChangeAccess input) {
        role(input.role());
        db.execute("SELECT pg_advisory_xact_lock(78120401)");
        var person=db.queryForList("SELECT id,username,role FROM staff_users WHERE id=? FOR UPDATE",id)
            .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Staff record not found"));
        if(person.get("username").equals(audit.actor())&&(!input.enabled()||!"ADMIN".equals(input.role())))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Cannot remove your own admin access");
        if("ADMIN".equals(person.get("role"))&&(!input.enabled()||!"ADMIN".equals(input.role()))) {
            Long admins=db.queryForObject("SELECT count(*) FROM staff_users WHERE role='ADMIN' AND enabled=true",Long.class);
            if(admins==null||admins<=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"At least one active administrator is required");
        }
        db.update("UPDATE staff_users SET role=?,enabled=?,tokens_revoked_before=now() WHERE id=?",input.role(),input.enabled(),id);
        db.update("UPDATE app_auth_sessions SET revoked_at=now() WHERE staff_id=? AND revoked_at IS NULL",id);
        audit.log("ACCESS_CHANGED","STAFF",id,"Role "+input.role()+", enabled "+input.enabled());
        return db.queryForMap("SELECT id,username,role,enabled,created_at FROM staff_users WHERE id=?",id);
    }
}
