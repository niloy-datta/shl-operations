package com.shl.operations.security;

import java.io.IOException;
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
    public BearerSessionFilter(SessionService sessions) { this.sessions=sessions; }

    // Password-only sessions may access only the minimum enrollment/logout endpoints.
    // Every request is evaluated against current staff MFA state, including old sessions.
    private static boolean enrollmentEndpoint(HttpServletRequest request) {
        String path=request.getRequestURI();
        String method=request.getMethod();
        return ("GET".equals(method) && "/api/auth/mfa/status".equals(path))
            || ("POST".equals(method) && (
                "/api/auth/mfa/enroll".equals(path) || "/api/auth/mfa/confirm".equals(path)))
            || ("DELETE".equals(method) && "/api/auth/sessions/current".equals(path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,
        FilterChain chain) throws ServletException, IOException {
        String auth=request.getHeader("Authorization");
        if (auth!=null && auth.startsWith("Bearer ")
            && SecurityContextHolder.getContext().getAuthentication()==null) {
            var valid=sessions.validate(auth.substring(7));
            if (valid!=null) {
                if (valid.enrollmentRequired() && !enrollmentEndpoint(request)) {
                    // sendError dispatches /error, which a deny-all security chain can
                    // transform into an unrelated 401. Return the intended 403 directly.
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.setHeader("Cache-Control","no-store");
                    response.getWriter().write("{\"error\":\"MFA enrollment required\"}");
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
