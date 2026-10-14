package com.shl.operations;

import com.shl.operations.security.BearerSessionFilter;
import com.shl.operations.security.SessionService;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class EnrollmentGateFilterTest {
    private final SessionService sessions=mock(SessionService.class);
    private final BearerSessionFilter filter=new BearerSessionFilter(sessions);
    private final String token="a".repeat(43);

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    private int status(String method,String path,boolean enrollmentOnly) throws Exception {
        SecurityContextHolder.clearContext();
        when(sessions.validate(token)).thenReturn(new SessionService.Valid(
            UUID.randomUUID(),UUID.randomUUID(),"operator","BD",enrollmentOnly));
        var req=new MockHttpServletRequest(method,path);
        req.addHeader("Authorization","Bearer "+token);
        var response=new MockHttpServletResponse();
        filter.doFilter(req,response,new MockFilterChain());
        return response.getStatus();
    }

    @Test void pendingEnrollmentCannotReadBusinessApis() throws Exception {
        assertThat(status("GET","/api/customers",true)).isEqualTo(403);
        assertThat(status("GET","/api/finance/invoices",true)).isEqualTo(403);
        assertThat(status("POST","/api/auth/mfa/disable",true)).isEqualTo(403);
        assertThat(status("GET","/api/auth/sessions",true)).isEqualTo(403);
    }
    @Test void pendingEnrollmentHasOnlySetupAndLogoutEndpoints() throws Exception {
        assertThat(status("GET","/api/auth/mfa/status",true)).isEqualTo(200);
        assertThat(status("POST","/api/auth/mfa/enroll",true)).isEqualTo(200);
        assertThat(status("POST","/api/auth/mfa/confirm",true)).isEqualTo(200);
        assertThat(status("DELETE","/api/auth/sessions/current",true)).isEqualTo(200);
        assertThat(status("GET","/api/customers",false)).isEqualTo(200);
    }
}
