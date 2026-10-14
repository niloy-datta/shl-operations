package com.shl.operations;

import com.shl.operations.security.BearerSessionFilter;
import com.shl.operations.security.MfaService;
import com.shl.operations.enterprise.AuditService;
import com.shl.operations.security.SessionService;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MandatoryMfaFilterTest {
    private static final String TOKEN = "A".repeat(43);

    @AfterEach void clearContext() { SecurityContextHolder.clearContext(); }

    private MockHttpServletResponse request(boolean required, boolean enrolled, String path)
        throws Exception {
        SecurityContextHolder.clearContext();
        SessionService sessions = mock(SessionService.class);
        when(sessions.validate(TOKEN)).thenReturn(new SessionService.Valid(
            UUID.randomUUID(), UUID.randomUUID(), "staff", "BD", enrolled));
        BearerSessionFilter filter = new BearerSessionFilter(sessions, required);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.addHeader("Authorization", "Bearer " + TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test void mandatoryPolicyBlocksNormalWorkflowsBeforeRoleChecks() throws Exception {
        assertThat(request(true, false, "/api/rfqs").getStatus()).isEqualTo(403);
        assertThat(request(true, false, "/api/costs/commissions").getStatus()).isEqualTo(403);
    }

    @Test void unenrolledStaffCanReachOnlyEnrollmentAndSessionRoutes() throws Exception {
        assertThat(request(true, false, "/api/auth/mfa/status").getStatus()).isEqualTo(200);
        assertThat(request(true, false, "/api/auth/mfa/enroll").getStatus()).isEqualTo(200);
        assertThat(request(true, false, "/api/auth/sessions/current").getStatus()).isEqualTo(200);
        assertThat(request(true, false, "/api/me").getStatus()).isEqualTo(200);
    }

    @Test void enforcedPolicyPreventsDisablingMfa() {
        MfaService mfa = new MfaService(mock(JdbcTemplate.class), mock(PasswordEncoder.class),
            mock(AuditService.class), "a".repeat(64), true);
        assertThatThrownBy(() -> mfa.disable("staff", "password", "123456"))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test void enabledMfaAndDevelopmentModeAllowNormalRequests() throws Exception {
        assertThat(request(true, true, "/api/rfqs").getStatus()).isEqualTo(200);
        assertThat(request(false, false, "/api/rfqs").getStatus()).isEqualTo(200);
    }
}
