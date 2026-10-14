package com.shl.operations;

import com.shl.operations.enterprise.StaffController;
import com.shl.operations.security.MfaService;
import com.shl.operations.security.SessionService;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456",
    "MFA_ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "MFA_ENFORCEMENT_ENABLED=true"
})
class MfaEnforcementIntegrationTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }
    @DynamicPropertySource static void datasource(DynamicPropertyRegistry r) {
        r.add("DB_URL",postgres::getJdbcUrl);
        r.add("DB_USERNAME",postgres::getUsername);
        r.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired StaffController staff;
    @Autowired SessionService sessions;
    @Autowired MfaService mfa;

    @Test @WithMockUser(username="test-admin",roles="ADMIN")
    void passwordOnlyIsRestrictedUntilEnrollment() {
        String name="mfa-policy-"+UUID.randomUUID().toString().substring(0,10);
        String password="temporary-staff-credential-12345";
        staff.create(new StaffController.NewStaff(name,password,"BD"));

        var initial=sessions.login(name,password);
        assertThat(initial.enrollmentRequired()).isTrue();
        assertThat(sessions.validate(initial.token()).enrollmentRequired()).isTrue();
        assertThat(mfa.status(name).required()).isTrue();

        var setup=mfa.enroll(name,password);
        String totp=MfaService.totpAt(setup.secret(),Instant.now().getEpochSecond()/30);
        var recovery=mfa.confirm(name,totp);
        assertThat(sessions.validate(initial.token())).isNull();

        var verified=sessions.login(name,password,recovery.get(0));
        assertThat(verified.enrollmentRequired()).isFalse();
        assertThat(sessions.validate(verified.token()).enrollmentRequired()).isFalse();
        assertThatThrownBy(()->mfa.disable(name,password,recovery.get(1)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }
}
