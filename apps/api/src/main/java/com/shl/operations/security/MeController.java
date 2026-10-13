package com.shl.operations.security;

import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me")
public class MeController {
    @GetMapping
    public Map<String,String> me(Authentication auth) {
        String role=auth.getAuthorities().stream().map(a->a.getAuthority())
            .filter(r->r.startsWith("ROLE_")).findFirst().orElse("ROLE_UNKNOWN").substring(5);
        return Map.of("username",auth.getName(),"role",role);
    }
}
