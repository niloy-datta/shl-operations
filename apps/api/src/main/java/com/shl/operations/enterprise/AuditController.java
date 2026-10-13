package com.shl.operations.enterprise;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/audit")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
public class AuditController {
    private final JdbcTemplate db;
    public AuditController(JdbcTemplate db) { this.db=db; }
    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="25") int size) {
        return Pages.of(db,"id,actor,action,entity_type,entity_id,detail,created_at",
            "FROM audit_events","",new Object[]{},
            "ORDER BY created_at DESC,id DESC",page,size);
    }
}
