package com.shl.operations.security;

import java.security.Principal;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/me")
public class MeController {
    @GetMapping public Map<String, String> me(Principal principal) { return Map.of("username", principal.getName()); }
}

