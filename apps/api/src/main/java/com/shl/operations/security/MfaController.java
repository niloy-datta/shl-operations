package com.shl.operations.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/mfa")
public class MfaController {
    private final MfaService mfa;
    public MfaController(MfaService mfa) { this.mfa=mfa; }
    public record PasswordInput(@NotBlank String password) {}
    public record CodeInput(@NotBlank String code) {}
    public record DisableInput(@NotBlank String password,@NotBlank String code) {}

    @GetMapping("/status")
    public MfaService.Status status(Principal principal) {
        return mfa.status(principal.getName());
    }
    @PostMapping("/enroll")
    public MfaService.Enrollment enroll(Principal principal,
        @Valid @RequestBody PasswordInput input) {
        return mfa.enroll(principal.getName(),input.password());
    }
    @PostMapping("/confirm")
    public Map<String,List<String>> confirm(Principal principal,
        @Valid @RequestBody CodeInput input) {
        return Map.of("recoveryCodes",mfa.confirm(principal.getName(),input.code()));
    }
    @PostMapping("/disable")
    public Map<String,Boolean> disable(Principal principal,
        @Valid @RequestBody DisableInput input) {
        mfa.disable(principal.getName(),input.password(),input.code());
        return Map.of("ok",true);
    }
}
