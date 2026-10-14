package com.shl.operations.security;

import com.shl.operations.enterprise.AuditService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Database-backed opaque sessions. The browser holds a random 256-bit token;
 * the database holds only its SHA-256 digest, never an encrypted password.
 */
@Service
public class SessionService {
    public static final int TTL_SECONDS = 8 * 60 * 60;
    private static final int MAX_FAILURES = 8;
    private static final int WINDOW_MINUTES = 15;
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private final MfaService mfa;
    private final boolean mfaEnforced;
    private final SecureRandom rng = new SecureRandom();
    private final String dummyHash;

    public SessionService(JdbcTemplate db, PasswordEncoder passwords, AuditService audit, MfaService mfa,
        @Value("${MFA_ENFORCEMENT_ENABLED:false}") boolean mfaEnforced) {
        this.db = db;
        this.passwords = passwords;
        this.audit = audit;
        this.mfa = mfa;
        this.mfaEnforced = mfaEnforced;
        this.dummyHash = passwords.encode("deliberately-not-a-real-credential");
    }

    public record Granted(String token, Instant expiresAt, String username, String role,
        boolean enrollmentRequired) {}
    public record Valid(UUID sessionId, UUID staffId, String username, String role,
        boolean enrollmentRequired) {}

    public static boolean validFormat(String token) {
        return token != null && token.matches("[A-Za-z0-9_-]{43}");
    }

    private static String hash(String input) {
        try {
            byte[] data = MessageDigest.getInstance("SHA-256")
                .digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(data);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        rng.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** A failed login must commit its counter; ResponseStatusException does not roll it back. */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public Granted login(String username, String password) {
        return login(username, password, null);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public Granted login(String username, String password, String verificationCode) {
        String name = username == null ? "" : username.trim();
        if (name.isBlank() || name.length() > 80 || password == null
            || password.isEmpty() || password.length() > 256) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid credentials");
        }
        String key = hash(name.toLowerCase(java.util.Locale.ROOT));
        db.update("""
            INSERT INTO auth_login_limits(login_key) VALUES (?)
            ON CONFLICT (login_key) DO NOTHING
            """, key);
        Map<String, Object> limiter = db.queryForMap(
            "SELECT * FROM auth_login_limits WHERE login_key=? FOR UPDATE", key);
        Instant now = Instant.now();
        var lock = limiter.get("locked_until");
        if (lock != null && ((java.sql.Timestamp)lock).toInstant().isAfter(now))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many attempts. Try again later.");

        Instant window = ((java.sql.Timestamp)limiter.get("window_started_at")).toInstant();
        int failures = (int)limiter.get("failures");
        if (window.isBefore(now.minus(WINDOW_MINUTES, ChronoUnit.MINUTES))
            || (lock != null && !((java.sql.Timestamp)lock).toInstant().isAfter(now))) {
            failures = 0;
            db.update("""
                UPDATE auth_login_limits
                SET failures=0,window_started_at=now(),locked_until=NULL WHERE login_key=?
                """, key);
        }

        List<Map<String, Object>> found = db.queryForList(
            "SELECT id,username,password_hash,role,enabled,mfa_enabled FROM staff_users WHERE username=?", name);
        Map<String, Object> staff = found.isEmpty() ? null : found.getFirst();
        boolean match = passwords.matches(password,
            staff == null ? dummyHash : (String)staff.get("password_hash"));
        boolean accountValid = match && staff != null && Boolean.TRUE.equals(staff.get("enabled"));
        if (accountValid && Boolean.TRUE.equals(staff.get("mfa_enabled"))
            && (verificationCode == null || verificationCode.isBlank())) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED,
                "Authenticator or recovery code required");
        }
        boolean factorValid = accountValid && (!Boolean.TRUE.equals(staff.get("mfa_enabled"))
            || mfa.verify((UUID)staff.get("id"), verificationCode));
        if (!factorValid) {
            int updated = failures + 1;
            db.update("""
                UPDATE auth_login_limits SET failures=?,
                  locked_until=CASE WHEN ? >= ? THEN now() + interval '15 minutes' ELSE NULL END
                WHERE login_key=?
                """, updated,updated,MAX_FAILURES,key);
            throw new ResponseStatusException(updated >= MAX_FAILURES ?
                HttpStatus.TOO_MANY_REQUESTS : HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        db.update("""
            UPDATE auth_login_limits SET failures=0,window_started_at=now(),locked_until=NULL
            WHERE login_key=?
            """,key);
        UUID staffId=(UUID)staff.get("id");
        // Bound the number of simultaneous sessions without touching the current login.
        db.update("""
            UPDATE auth_sessions SET revoked_at=now()
            WHERE staff_id=? AND revoked_at IS NULL
              AND id NOT IN (
                SELECT id FROM auth_sessions WHERE staff_id=?
                  AND revoked_at IS NULL AND expires_at>now()
                ORDER BY created_at DESC,id DESC LIMIT 4
              )
            """,staffId,staffId);
        String token=newToken();
        Instant expiry=now.plusSeconds(TTL_SECONDS);
        UUID sessionId=UUID.randomUUID();
        db.update("""
            INSERT INTO auth_sessions(id,staff_id,token_hash,expires_at)
            VALUES(?,?,?,?)
            """,sessionId,staffId,hash(token),java.sql.Timestamp.from(expiry));
        audit.log("LOGIN","STAFF",staffId,"New session "+sessionId);
        return new Granted(token,expiry,(String)staff.get("username"),(String)staff.get("role"),
            mfaEnforced && !Boolean.TRUE.equals(staff.get("mfa_enabled")));
    }

    public Valid validate(String token) {
        if (!validFormat(token)) return null;
        return db.query("""
            SELECT s.id AS session_id,u.id AS staff_id,u.username,u.role,u.mfa_enabled
            FROM auth_sessions s JOIN staff_users u ON u.id=s.staff_id
            WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>now()
              AND u.enabled=true
              AND (u.password_changed_at IS NULL OR s.created_at > u.password_changed_at)
            """, (rs, ignored)->new Valid(
                rs.getObject("session_id",UUID.class),
                rs.getObject("staff_id",UUID.class),
                rs.getString("username"),rs.getString("role"),
                mfaEnforced && !rs.getBoolean("mfa_enabled")),hash(token)
        ).stream().findFirst().orElse(null);
    }

    public List<Map<String,Object>> list(String username) {
        return db.queryForList("""
            SELECT s.id,s.created_at,s.expires_at
            FROM auth_sessions s JOIN staff_users u ON u.id=s.staff_id
            WHERE u.username=? AND s.revoked_at IS NULL AND s.expires_at>now()
            ORDER BY s.created_at DESC LIMIT 20
            """,username);
    }

    @Transactional
    public boolean revokeCurrent(String token) {
        Valid v=validate(token);
        if (v == null) return false;
        db.update("UPDATE auth_sessions SET revoked_at=now() WHERE id=?",v.sessionId());
        audit.log("SESSION_REVOKED","STAFF",v.staffId(),"Current session");
        return true;
    }

    @Transactional
    public void revokeOwned(String username,UUID id) {
        List<Map<String,Object>> rows=db.queryForList("""
            SELECT s.staff_id FROM auth_sessions s JOIN staff_users u ON u.id=s.staff_id
            WHERE s.id=? AND u.username=? AND s.revoked_at IS NULL
            """,id,username);
        if (rows.isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Session not found");
        db.update("UPDATE auth_sessions SET revoked_at=now() WHERE id=?",id);
        audit.log("SESSION_REVOKED","STAFF",(UUID)rows.getFirst().get("staff_id"),
            "Session "+id);
    }
}
