package com.shl.operations.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration @EnableMethodSecurity
public class SecurityConfig {
    @Bean JwtDecoder jwtDecoder(@Value("${northstar.auth.issuer}") String issuer,
        @Value("${northstar.auth.jwks-uri}") String jwks, @Value("${northstar.auth.mode:jwks}") String mode,
        @Value("${northstar.auth.publishable-key:}") String key) {
        return SupabaseJwtDecoder.create(issuer, jwks, mode, key);
    }
    @Bean SecurityFilterChain filterChain(HttpSecurity http, JdbcTemplate db, ObjectMapper json) throws Exception {
        return http.csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(access -> access
                .requestMatchers("/api/me", "/api/auth/sessions", "/api/auth/sessions/**").authenticated()
                .requestMatchers("/api/staff/options").authenticated()
                .requestMatchers("/api/staff", "/api/staff/**").hasRole("ADMIN")
                .requestMatchers("/api/audit", "/api/audit/**", "/api/dedup/**", "/api/command-center/**").hasAnyRole("ADMIN", "MANAGEMENT")
                .requestMatchers("/api/entities", "/api/entities/**").hasAnyRole("ADMIN", "MANAGEMENT", "BD", "SOURCING")
                .requestMatchers("/api/growth/leads", "/api/growth/leads/**").hasAnyRole("ADMIN", "MANAGEMENT", "BD")
                .requestMatchers("/api/costs/commissions", "/api/costs/commissions/**").authenticated()
                .requestMatchers("/api/costs/**", "/api/finance/**").hasAnyRole("ADMIN", "MANAGEMENT", "FINANCE")
                .requestMatchers("/api/logistics/**").hasAnyRole("ADMIN", "MANAGEMENT", "LOGISTICS", "SOURCING")
                .requestMatchers("/api/rfqs", "/api/rfqs/**").hasAnyRole("ADMIN", "MANAGEMENT", "BD", "SOURCING")
                .requestMatchers(HttpMethod.GET, "/api/customers", "/api/suppliers", "/api/dashboard").hasAnyRole("ADMIN", "MANAGEMENT", "BD", "SOURCING", "LOGISTICS", "FINANCE")
                .requestMatchers(HttpMethod.POST, "/api/customers", "/api/suppliers").hasAnyRole("ADMIN", "MANAGEMENT", "BD", "SOURCING")
                .requestMatchers(HttpMethod.PUT, "/api/customers/*", "/api/suppliers/*").hasAnyRole("ADMIN", "MANAGEMENT", "BD", "SOURCING")
                .requestMatchers("/api/commerce/**", "/api/growth/projects", "/api/growth/projects/**", "/api/tasks", "/api/tasks/**", "/api/alerts").hasAnyRole("ADMIN", "MANAGEMENT", "BD", "SOURCING", "LOGISTICS", "FINANCE")
                .anyRequest().denyAll())
            .oauth2ResourceServer(server -> server.jwt(jwt -> {}).authenticationEntryPoint((request, response, error) -> {
                response.setHeader("WWW-Authenticate", "Bearer");
                response.setStatus(401); response.setContentType("application/json");
                json.writeValue(response.getOutputStream(), Map.of("error", "A valid sign-in token is required.", "code", "SIGN_IN_REQUIRED"));
            }))
            .exceptionHandling(errors -> errors.accessDeniedHandler((request, response, error) -> {
                response.setStatus(403); response.setContentType("application/json");
                json.writeValue(response.getOutputStream(), Map.of("error", "Your staff role does not permit this action.", "code", "ACCESS_DENIED"));
            }))
            .addFilterAfter(new StaffAccessFilter(db, json), BearerTokenAuthenticationFilter.class)
            .headers(headers -> headers.cacheControl(cache -> {}))
            .httpBasic(basic -> basic.disable()).formLogin(form -> form.disable()).build();
    }
}
