package com.shl.operations.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

final class StaffAccessFilter extends OncePerRequestFilter {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    StaffAccessFilter(JdbcTemplate db, ObjectMapper json) { this.db = db; this.json = json; }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken auth)) {
            chain.doFilter(request, response); return;
        }
        try {
            var jwt = auth.getToken();
            var staff = db.queryForList("SELECT id,username,role,enabled,mfa_required,tokens_revoked_before FROM staff_users WHERE supabase_user_id=?", UUID.fromString(jwt.getSubject()));
            if (staff.size() != 1 || !Boolean.TRUE.equals(staff.getFirst().get("enabled"))) {
                reject(response, 403, "STAFF_ACCESS_REQUIRED", "An enabled staff account must be linked to this identity."); return;
            }
            var person = staff.getFirst();
            Timestamp cutoff = (Timestamp) person.get("tokens_revoked_before");
            if (cutoff != null && !jwt.getIssuedAt().isAfter(cutoff.toInstant())) {
                reject(response, 401, "SESSION_REVOKED", "Sign in again to renew workspace access."); return;
            }
            var session = db.queryForList("""
                INSERT INTO app_auth_sessions(session_id,staff_id,expires_at) VALUES(?,?,?)
                ON CONFLICT(session_id) DO UPDATE SET expires_at=GREATEST(app_auth_sessions.expires_at,EXCLUDED.expires_at),last_seen_at=now()
                WHERE app_auth_sessions.staff_id=EXCLUDED.staff_id AND app_auth_sessions.revoked_at IS NULL
                RETURNING session_id
                """, UUID.fromString(jwt.getClaimAsString("session_id")), person.get("id"), Timestamp.from(jwt.getExpiresAt()));
            if (session.isEmpty()) { reject(response, 401, "SESSION_REVOKED", "This workspace session has been revoked. Sign in again."); return; }
            // App roles are read from the database on every request, never from editable JWT metadata.
            var mapped = new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + person.get("role"))), (String) person.get("username"));
            SecurityContextHolder.getContext().setAuthentication(mapped);
            String path = request.getServletPath();
            boolean securityAccountRoute = path.equals("/api/me") || path.startsWith("/api/auth/sessions");
            boolean sensitive = path.startsWith("/api/staff") || path.startsWith("/api/finance") || path.startsWith("/api/costs") || path.startsWith("/api/audit") || path.startsWith("/api/command-center");
            if (!securityAccountRoute && (sensitive || Boolean.TRUE.equals(person.get("mfa_required"))) && !"aal2".equals(jwt.getClaimAsString("aal"))) {
                reject(response, 403, "MFA_REQUIRED", "Verify your authenticator before accessing business records."); return;
            }
        } catch (DataAccessException error) {
            reject(response, 503, "ACCESS_SERVICE_UNAVAILABLE", "Staff authorization could not be verified."); return;
        } catch (IllegalArgumentException error) {
            reject(response, 401, "INVALID_TOKEN", "Identity claims are invalid."); return;
        }
        chain.doFilter(request, response);
    }
    private void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        if(status==401)response.setHeader("WWW-Authenticate", "Bearer");
        response.setStatus(status); response.setContentType("application/json");
        json.writeValue(response.getOutputStream(), Map.of("error", message, "code", code));
    }
}
