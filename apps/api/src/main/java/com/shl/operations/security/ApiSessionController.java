package com.shl.operations.security;

import com.shl.operations.enterprise.AuditService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/auth/sessions")
public class ApiSessionController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public ApiSessionController(JdbcTemplate db, AuditService audit) { this.db = db; this.audit = audit; }
    private UUID staff(JwtAuthenticationToken auth) {
        return db.queryForObject("SELECT id FROM staff_users WHERE username=? AND enabled=true", UUID.class, auth.getName());
    }
    @GetMapping public List<Map<String,Object>> sessions(JwtAuthenticationToken auth) {
        return db.queryForList("""
            SELECT session_id AS id,created_at,expires_at,session_id=? AS current
            FROM app_auth_sessions WHERE staff_id=? AND revoked_at IS NULL AND expires_at>now()
            ORDER BY created_at DESC LIMIT 100
            """, UUID.fromString(auth.getToken().getClaimAsString("session_id")), staff(auth));
    }
    @DeleteMapping("/{id}") @Transactional public Map<String,Boolean> revoke(@PathVariable UUID id, JwtAuthenticationToken auth) {
        int count = db.update("UPDATE app_auth_sessions SET revoked_at=now() WHERE session_id=? AND staff_id=? AND revoked_at IS NULL", id, staff(auth));
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace session not found");
        audit.log("SESSION_REVOKED", "SESSION", id, "Workspace API access revoked");
        return Map.of("ok", true);
    }
    @PostMapping("/current") @Transactional public Map<String,Boolean> current(JwtAuthenticationToken auth) {
        return revoke(UUID.fromString(auth.getToken().getClaimAsString("session_id")), auth);
    }
    @PostMapping("/all") @Transactional public Map<String,Boolean> all(JwtAuthenticationToken auth) {
        UUID staff = staff(auth);
        db.update("UPDATE staff_users SET tokens_revoked_before=now() WHERE id=?", staff);
        db.update("UPDATE app_auth_sessions SET revoked_at=now() WHERE staff_id=? AND revoked_at IS NULL", staff);
        audit.log("ALL_SESSIONS_REVOKED", "STAFF", staff, "All workspace API sessions revoked");
        return Map.of("ok", true);
    }
}
