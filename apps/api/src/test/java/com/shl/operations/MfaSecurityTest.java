package com.shl.operations;

import com.shl.operations.enterprise.StaffController;
import com.shl.operations.security.MfaService;
import com.shl.operations.security.SessionService;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456",
    "MFA_ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
})
class MfaSecurityTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static {postgres.start();}
    @DynamicPropertySource static void dbProperties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired MfaService mfa;
    @Autowired SessionService sessions;
    @Autowired StaffController staff;
    @Autowired JdbcTemplate db;
    private static final String PASSWORD="unique-mfa-password-24567";

    @Test void rfc6238TestVector() {
        // RFC 6238 SHA1 vector: 94287082 (8 digits), or 287082 (6 digits).
        assertThat(MfaService.totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",1L))
            .isEqualTo("287082");
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void enrollmentRequiresTotpAndRecoveryCodesCannotBeReplayed() {
        String name="mfa-"+UUID.randomUUID().toString().substring(0,12);
        var member=staff.create(new StaffController.NewStaff(name,PASSWORD,"BD"));
        UUID id=(UUID)member.get("id");
        var old=sessions.login(name,PASSWORD);
        assertThat(mfa.status(name).enabled()).isFalse();

        var enrollment=mfa.enroll(name,PASSWORD);
        assertThat(enrollment.otpAuthUrl()).contains("otpauth://totp/","issuer=SHL%20Operations");
        assertThat(enrollment.secret()).matches("[A-Z2-7]{32}");
        var stored=db.queryForMap("SELECT mfa_pending_enc FROM staff_users WHERE id=?",id);
        assertThat((String)stored.get("mfa_pending_enc")).doesNotContain(enrollment.secret());
        String currentCode=MfaService.totpAt(enrollment.secret(),Instant.now().getEpochSecond()/30);
        var recovery=mfa.confirm(name,currentCode);
        assertThat(recovery).hasSize(8).allMatch(code->code.matches("[A-Z2-7]{4}(-[A-Z2-7]{4}){3}"));
        assertThat(mfa.status(name).enabled()).isTrue();
        assertThat(mfa.status(name).recoveryCodesRemaining()).isEqualTo(8);
        assertThat(sessions.validate(old.token())).isNull();
        assertThat(mfa.verify(id,currentCode)).isFalse();
        assertThatThrownBy(()->sessions.login(name,PASSWORD))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e->assertThat(((ResponseStatusException)e).getStatusCode())
                .isEqualTo(HttpStatus.PRECONDITION_REQUIRED));

        var successful=sessions.login(name,PASSWORD,recovery.get(0));
        assertThat(sessions.validate(successful.token())).isNotNull();
        assertThat(mfa.status(name).recoveryCodesRemaining()).isEqualTo(7);
        assertThatThrownBy(()->sessions.login(name,PASSWORD,recovery.get(0)))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e->assertThat(((ResponseStatusException)e).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED));

        mfa.disable(name,PASSWORD,recovery.get(1));
        assertThat(mfa.status(name).enabled()).isFalse();
        assertThat(mfa.status(name).recoveryCodesRemaining()).isZero();
        assertThat(sessions.validate(successful.token())).isNull();
        assertThat(sessions.validate(sessions.login(name,PASSWORD).token())).isNotNull();
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void mfaCannotBeEnabledWithoutCorrectCurrentPassword() {
        String name="protect-"+UUID.randomUUID().toString().substring(0,12);
        staff.create(new StaffController.NewStaff(name,PASSWORD,"BD"));
        assertThatThrownBy(()->mfa.enroll(name,"wrong-password"))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(mfa.status(name).enrollmentPending()).isFalse();
    }
}
