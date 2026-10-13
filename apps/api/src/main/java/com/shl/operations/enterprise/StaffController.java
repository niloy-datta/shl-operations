package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/staff")
public class StaffController {
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private static final Set<String> ROLES=Set.of("ADMIN","MANAGEMENT","BD","SOURCING","LOGISTICS","FINANCE");
    public StaffController(JdbcTemplate db,PasswordEncoder passwords,AuditService audit) {
        this.db=db;this.passwords=passwords;this.audit=audit;
    }
    public record NewStaff(@NotBlank @Pattern(regexp="[A-Za-z0-9._-]{3,80}") String username,
        @NotBlank @Size(min=16,max=128) String password,@NotBlank String role) {}
    public record ChangeAccess(@NotBlank String role,boolean enabled) {}
    public record ChangePassword(@NotBlank String currentPassword,
        @NotBlank @Size(min=16,max=128) String newPassword) {}
    private void role(String name) {
        if (!ROLES.contains(name)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid staff role");
    }
    @GetMapping("/options")
    @PreAuthorize("isAuthenticated()")
    public List<Map<String,Object>> options() {
        return db.queryForList("""
            SELECT id,username,role FROM staff_users WHERE enabled=true ORDER BY username LIMIT 200
            """);
    }
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Pages.Result list(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size) {
        return Pages.of(db,"id,username,role,enabled,created_at,password_changed_at",
            "FROM staff_users","",new Object[]{},
            "ORDER BY created_at DESC,id DESC",page,size);
    }
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> create(@Valid @RequestBody NewStaff input) {
        role(input.role());
        UUID id=UUID.randomUUID();
        Long existing=db.queryForObject("SELECT count(*) FROM staff_users WHERE username=?",
            Long.class,input.username().trim());
        if (existing!=null && existing>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Username already exists");
        db.update("""
            INSERT INTO staff_users(id,username,password_hash,role,enabled,password_changed_at)
            VALUES(?,?,?,?,true,now())
            """,id,input.username().trim(),passwords.encode(input.password()),input.role());
        audit.log("CREATED","STAFF",id,"Role "+input.role());
        return db.queryForMap("SELECT id,username,role,enabled,created_at FROM staff_users WHERE id=?",id);
    }
    @PatchMapping("/{id}/access")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public Map<String,Object> changeAccess(@PathVariable UUID id,@Valid @RequestBody ChangeAccess input) {
        role(input.role());
        var staff=db.queryForList("SELECT * FROM staff_users WHERE id=? FOR UPDATE",id)
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username=(String)staff.get("username");
        if (username.equals(audit.actor()) && (!input.enabled() || !"ADMIN".equals(input.role())))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Cannot remove your own admin access");
        if ("ADMIN".equals(staff.get("role")) && (!input.enabled() || !"ADMIN".equals(input.role()))) {
            Long admins=db.queryForObject("""
                SELECT count(*) FROM staff_users WHERE role='ADMIN' AND enabled=true
                """,Long.class);
            if (admins!=null && admins<=1)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"At least one active admin required");
        }
        db.update("UPDATE staff_users SET role=?,enabled=? WHERE id=?",input.role(),input.enabled(),id);
        // Permissions change must not leave old role-bearing sessions active.
        db.update("UPDATE auth_sessions SET revoked_at=now() WHERE staff_id=? AND revoked_at IS NULL",id);
        audit.log("ACCESS_CHANGED","STAFF",id,"Role "+input.role()+", enabled "+input.enabled());
        return db.queryForMap("SELECT id,username,role,enabled,created_at FROM staff_users WHERE id=?",id);
    }
    @PostMapping("/password")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public Map<String,Boolean> changePassword(@Valid @RequestBody ChangePassword input) {
        var me=db.queryForMap("SELECT id,password_hash FROM staff_users WHERE username=? FOR UPDATE",audit.actor());
        if (!passwords.matches(input.currentPassword(),(String)me.get("password_hash")))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Current password is incorrect");
        if (input.newPassword().equals(input.currentPassword()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a different password");
        UUID id=(UUID)me.get("id");
        db.update("UPDATE staff_users SET password_hash=?,password_changed_at=now() WHERE id=?",
            passwords.encode(input.newPassword()),id);
        db.update("UPDATE auth_sessions SET revoked_at=now() WHERE staff_id=? AND revoked_at IS NULL",id);
        audit.log("PASSWORD_CHANGED","STAFF",id,"Self-service password change");
        return Map.of("ok",true);
    }
}
