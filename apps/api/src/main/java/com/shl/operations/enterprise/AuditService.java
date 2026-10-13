package com.shl.operations.enterprise;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final JdbcTemplate db;
    public AuditService(JdbcTemplate db) { this.db = db; }
    public String actor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
    public void log(String action, String type, UUID id, String detail) {
        db.update("INSERT INTO audit_events(id,actor,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?)",
            UUID.randomUUID(), actor(), action, type, id, detail == null ? null :
                detail.substring(0, Math.min(300, detail.length())));
    }
}
