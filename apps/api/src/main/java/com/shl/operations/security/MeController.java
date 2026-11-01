package com.shl.operations.security;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me")
public class MeController {
    private final JdbcTemplate db;
    public MeController(JdbcTemplate db) { this.db = db; }
    @GetMapping public Map<String,Object> me(Authentication auth) {
        return db.queryForMap("SELECT username,role,mfa_required AS \"mfaRequired\" FROM staff_users WHERE username=? AND enabled=true", auth.getName());
    }
}
