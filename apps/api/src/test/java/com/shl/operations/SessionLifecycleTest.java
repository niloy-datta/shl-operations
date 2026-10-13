package com.shl.operations;

import com.shl.operations.enterprise.StaffController;
import com.shl.operations.security.SessionService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"
})
class SessionLifecycleTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("DB_URL",postgres::getJdbcUrl);
        r.add("DB_USERNAME",postgres::getUsername);
        r.add("DB_PASSWORD",postgres::getPassword);
    }

    @Autowired SessionService sessions;
    @Autowired StaffController staff;
    @Autowired JdbcTemplate db;
    private static final String PASSWORD="strong-operator-password-0001";

    private record Person(UUID id,String username) {}
    private Person createPerson() {
        String name="staff-"+UUID.randomUUID().toString().substring(0,12);
        var data=staff.create(new StaffController.NewStaff(name,PASSWORD,"BD"));
        return new Person((UUID)data.get("id"),name);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void opaqueTokensCanBeRevokedAndNeverAppearInDatabase() {
        Person person=createPerson();
        var granted=sessions.login(person.username(),PASSWORD);
        assertThat(granted.token()).matches("[A-Za-z0-9_-]{43}");
        assertThat(granted.username()).isEqualTo(person.username());
        assertThat(sessions.validate(granted.token())).isNotNull();
        assertThat(sessions.list(person.username())).hasSize(1);
        assertThat(db.queryForObject("SELECT count(*) FROM auth_sessions WHERE token_hash=?",
            Long.class,granted.token())).isZero();
        assertThat(sessions.revokeCurrent(granted.token())).isTrue();
        assertThat(sessions.validate(granted.token())).isNull();
        assertThat(sessions.revokeCurrent(granted.token())).isFalse();
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void disablingOrChangingRolesRevokesPreviousSessions() {
        Person person=createPerson();
        var first=sessions.login(person.username(),PASSWORD);
        staff.changeAccess(person.id(),new StaffController.ChangeAccess("LOGISTICS",true));
        assertThat(sessions.validate(first.token())).isNull();
        var second=sessions.login(person.username(),PASSWORD);
        assertThat(sessions.validate(second.token()).role()).isEqualTo("LOGISTICS");
        staff.changeAccess(person.id(),new StaffController.ChangeAccess("LOGISTICS",false));
        assertThat(sessions.validate(second.token())).isNull();
        assertThatThrownBy(()->sessions.login(person.username(),PASSWORD))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void changingPasswordRevokesAllSessionsAndOldPassword() {
        Person person=createPerson();
        var first=sessions.login(person.username(),PASSWORD);
        var previous=SecurityContextHolder.getContext().getAuthentication();
        try {
            SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(person.username(),null,
                    List.of(new SimpleGrantedAuthority("ROLE_BD"))));
            staff.changePassword(new StaffController.ChangePassword(PASSWORD,
                "unique-replacement-password-0002"));
        } finally {
            SecurityContextHolder.getContext().setAuthentication(previous);
        }
        assertThat(sessions.validate(first.token())).isNull();
        assertThatThrownBy(()->sessions.login(person.username(),PASSWORD))
            .isInstanceOf(ResponseStatusException.class);
        var replacement=sessions.login(person.username(),"unique-replacement-password-0002");
        assertThat(sessions.validate(replacement.token())).isNotNull();
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void repeatedBadPasswordsAreThrottledPersistently() {
        Person person=createPerson();
        for (int i=0;i<7;i++) {
            assertThatThrownBy(()->sessions.login(person.username(),"incorrect-password"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(exception->assertThat(((ResponseStatusException)exception).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED));
        }
        assertThatThrownBy(()->sessions.login(person.username(),"incorrect-password"))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(exception->assertThat(((ResponseStatusException)exception).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        assertThatThrownBy(()->sessions.login(person.username(),PASSWORD))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(exception->assertThat(((ResponseStatusException)exception).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
    }
}
