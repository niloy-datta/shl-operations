package com.shl.operations.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.*;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StaffAccessFilterTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void databaseOutageNeverGrantsAccess() throws Exception {
        var db=mock(JdbcTemplate.class);
        when(db.queryForList(anyString(),any(UUID.class))).thenThrow(new DataAccessResourceFailureException("test outage"));
        var jwt=Jwt.withTokenValue("synthetic-test-token").header("alg","RS256").subject(UUID.randomUUID().toString())
            .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).claim("session_id",UUID.randomUUID().toString()).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
        var request=new MockHttpServletRequest("GET","/api/dashboard");
        request.setServletPath("/api/dashboard");
        var response=new MockHttpServletResponse();
        var continued=new AtomicBoolean(false);
        new StaffAccessFilter(db,new ObjectMapper()).doFilter(request,response,(req,res)->continued.set(true));
        assertThat(continued).isFalse();
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentAsString()).contains("ACCESS_SERVICE_UNAVAILABLE").doesNotContain("test outage");
    }
}
