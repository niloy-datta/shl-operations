package com.shl.operations.security;

import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class BearerSessionFilter extends OncePerRequestFilter {
    private final SessionService sessions;
    private final boolean mandatoryMfa;
    public BearerSessionFilter(SessionService sessions,
        @Value("${SHL_REQUIRE_MFA:false}") boolean mandatoryMfa) {
        this.sessions=sessions;
        this.mandatoryMfa=mandatoryMfa;
    }

    private static boolean enrollmentEndpoint(String path) {
        return path.equals("/api/me") || path.equals("/api/auth/sessions")
            || path.startsWith("/api/auth/sessions/")
            || path.startsWith("/api/auth/mfa/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,
        FilterChain chain) throws ServletException, IOException {
        String auth=request.getHeader("Authorization");
        if (auth!=null && auth.startsWith("Bearer ")
            && SecurityContextHolder.getContext().getAuthentication()==null) {
            var valid=sessions.validate(auth.substring(7));
            if (valid!=null) {
                // Password-authenticated sessions without MFA may only enroll or sign out.
                // Enforce before Spring role checks to cover endpoints that merely require auth.
                if (mandatoryMfa && !valid.mfaEnabled()
                    && !enrollmentEndpoint(request.getRequestURI())) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN,
                        "Authenticator setup required");
                    return;
                }
                var ctx=SecurityContextHolder.createEmptyContext();
                ctx.setAuthentication(new UsernamePasswordAuthenticationToken(
                    valid.username(),null,
                    java.util.List.of(new SimpleGrantedAuthority("ROLE_"+valid.role()))));
                SecurityContextHolder.setContext(ctx);
            }
        }
        chain.doFilter(request,response);
    }
}
