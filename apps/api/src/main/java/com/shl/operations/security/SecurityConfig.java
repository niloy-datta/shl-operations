package com.shl.operations.security;

import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.http.SessionCreationPolicy;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean UserDetailsService users(JdbcTemplate db) {
        return username -> db.query("SELECT username, password_hash, role, enabled FROM staff_users WHERE username = ?",
            (rs, row) -> User.withUsername(rs.getString("username"))
                .password(rs.getString("password_hash"))
                .authorities("ROLE_" + rs.getString("role"))
                .disabled(!rs.getBoolean("enabled")).build(), username)
            .stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }

    @Bean ApplicationRunner bootstrapAdmin(JdbcTemplate db, PasswordEncoder encoder,
        @Value("${BOOTSTRAP_ADMIN_USERNAME}") String username,
        @Value("${BOOTSTRAP_ADMIN_PASSWORD}") String password) {
        return args -> {
            if (username.isBlank() || password.length() < 16 || password.startsWith("replace-"))
                throw new IllegalStateException("Set a unique admin password of at least 16 characters");
            Integer count = db.queryForObject("SELECT count(*) FROM staff_users", Integer.class);
            if (count != null && count == 0) db.update(
                "INSERT INTO staff_users (id, username, password_hash, role, enabled) VALUES (?, ?, ?, 'ADMIN', true)",
                UUID.randomUUID(), username, encoder.encode(password));
        };
    }

    @Bean SecurityFilterChain filterChain(HttpSecurity http, BearerSessionFilter sessionFilter) throws Exception {
        return http.csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/sessions").permitAll()
                .requestMatchers("/api/auth/sessions/**", "/api/auth/sessions").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/me").authenticated()
                
                .requestMatchers("/api/staff/password", "/api/staff/options").authenticated()
                .requestMatchers("/api/staff/**", "/api/staff").hasRole("ADMIN")
                .requestMatchers("/api/audit/**", "/api/audit").hasAnyRole("ADMIN","MANAGEMENT")
                .requestMatchers("/api/finance/**").hasAnyRole("ADMIN","MANAGEMENT","FINANCE")
                .requestMatchers("/api/commerce/**").hasAnyRole("ADMIN","MANAGEMENT","BD","SOURCING","LOGISTICS","FINANCE")
                .requestMatchers("/api/logistics/**").hasAnyRole("ADMIN","MANAGEMENT","LOGISTICS","SOURCING")
                .requestMatchers("/api/tasks/**", "/api/tasks").hasAnyRole("ADMIN","MANAGEMENT","BD","SOURCING","LOGISTICS","FINANCE")
                .requestMatchers("/api/rfqs/**", "/api/rfqs").hasAnyRole("ADMIN","MANAGEMENT","BD","SOURCING")
                .requestMatchers(HttpMethod.GET,"/api/customers","/api/suppliers","/api/dashboard")
                    .hasAnyRole("ADMIN","MANAGEMENT","BD","SOURCING","LOGISTICS","FINANCE")
                .requestMatchers(HttpMethod.POST,"/api/customers","/api/suppliers")
                    .hasAnyRole("ADMIN","MANAGEMENT","BD","SOURCING")
                .requestMatchers(HttpMethod.PUT,"/api/customers/*","/api/suppliers/*")
                    .hasAnyRole("ADMIN","MANAGEMENT","BD","SOURCING")
                .requestMatchers("/api/**").denyAll()
                .anyRequest().denyAll())
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .exceptionHandling(e -> e.authenticationEntryPoint(
                (req, res, ex) -> res.sendError(401, "Authentication required")))
            .addFilterBefore(sessionFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}

