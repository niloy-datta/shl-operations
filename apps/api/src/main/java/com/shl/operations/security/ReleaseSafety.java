package com.shl.operations.security;

import java.util.Arrays;

/** Reject unsafe release configuration before accepting production traffic. */
public final class ReleaseSafety {
    private ReleaseSafety() {}

    public static boolean isProduction(String mode, String activeProfiles) {
        if ("production".equalsIgnoreCase(mode) || "prod".equalsIgnoreCase(mode)) return true;
        if (activeProfiles == null) return false;
        return Arrays.stream(activeProfiles.split(","))
            .map(String::trim)
            .anyMatch(p -> "prod".equalsIgnoreCase(p) || "production".equalsIgnoreCase(p));
    }

    public static void verify(String mode, String profiles, boolean enforcedMfa, String key) {
        if (!isProduction(mode, profiles)) return;
        if (!enforcedMfa)
            throw new IllegalStateException("Production requires MFA_ENFORCEMENT_ENABLED=true");
        if (key == null || !key.matches("[0-9a-fA-F]{64}"))
            throw new IllegalStateException("Production requires a configured 256-bit MFA encryption key");
    }
}
