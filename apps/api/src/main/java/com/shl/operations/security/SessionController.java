package com.shl.operations.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth/sessions")
public class SessionController {
    private final SessionService sessions;
    public SessionController(SessionService sessions) { this.sessions=sessions; }

    public record Login(@NotBlank @Size(max=80) String username,
        @NotBlank @Size(max=256) String password,
        @Size(max=40) String code) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionService.Granted login(@Valid @RequestBody Login input) {
        return sessions.login(input.username(),input.password(),input.code());
    }

    @GetMapping
    public List<Map<String,Object>> list(Principal principal,
        @RequestHeader("Authorization") String authorization) {
        String token=authorization.startsWith("Bearer ") ? authorization.substring(7) : "";
        var current=sessions.validate(token);
        return sessions.list(principal.getName()).stream().map(row -> {
            Map<String,Object> result=new HashMap<>(row);
            result.put("current",current!=null && current.sessionId().equals(row.get("id")));
            return result;
        }).toList();
    }

    @DeleteMapping("/current")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader("Authorization") String authorization) {
        String token=authorization.startsWith("Bearer ") ? authorization.substring(7) : "";
        if (!sessions.revokeCurrent(token))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Session invalid");
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable UUID id,Principal principal) {
        sessions.revokeOwned(principal.getName(),id);
    }
}
