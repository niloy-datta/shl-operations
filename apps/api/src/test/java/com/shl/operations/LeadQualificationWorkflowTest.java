package com.shl.operations;

import com.shl.operations.enterprise.GrowthController;
import com.shl.operations.enterprise.LeadQualificationController;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
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
class LeadQualificationWorkflowTest {
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }

    @Autowired JdbcTemplate db;
    @Autowired GrowthController growth;
    @Autowired LeadQualificationController qualification;

    private UUID lead() {
        String suffix = UUID.randomUUID().toString();
        return (UUID)growth.addLead(new GrowthController.LeadInput(
            null, "Buyer " + suffix, "Contact", "test@example.test", "MANUAL",
            "Test opportunity " + suffix, null, null, null)).getBody().get("id");
    }

    @Test
    @WithMockUser(username="test-admin", roles="ADMIN")
    void scoringIsExplainableRecomputedAndReadOnly() {
        UUID id = lead();
        var initial = qualification.qualify(id);
        assertThat(initial.score()).isEqualTo(5);
        assertThat(initial.band()).isEqualTo("LOW");
        assertThat(initial.nextActions()).anyMatch(x -> x.contains("owner"));
        Long auditCount = db.queryForObject(
            "SELECT count(*) FROM audit_events WHERE entity_id=?", Long.class, id);
        qualification.qualify(id);
        assertThat(db.queryForObject(
            "SELECT count(*) FROM audit_events WHERE entity_id=?", Long.class, id))
            .isEqualTo(auditCount);

        UUID owner = UUID.randomUUID();
        db.update("""
            INSERT INTO staff_users(id,username,password_hash,role,enabled)
            VALUES(?,?,?,'BD',true)
            """, owner, "qual-" + owner.toString().substring(0,10), "not-a-login-password");
        db.update("UPDATE crm_leads SET owner_id=? WHERE id=?", owner, id);
        growth.leadStatus(id, new GrowthController.ChangeStatus("CONTACTED"));
        growth.leadStatus(id, new GrowthController.ChangeStatus("QUALIFIED"));
        growth.addLeadActivity(id, new GrowthController.LeadActivityInput(
            "CALL", "Contacted prospective buyer", LocalDate.now(ZoneOffset.UTC).plusDays(3)));

        var updated = qualification.qualify(id);
        assertThat(updated.score()).isEqualTo(85);
        assertThat(updated.band()).isEqualTo("HIGH");
        assertThat(updated.signals()).anyMatch(x -> x.contains("qualified"));
        assertThat(updated.disclaimer()).contains("not a conversion probability");
        growth.leadStatus(id, new GrowthController.ChangeStatus("WON"));

        var closed = qualification.qualify(id);
        assertThat(closed.score()).isNull();
        assertThat(closed.band()).isEqualTo("CLOSED");
        assertThat(closed.nextActions()).isEmpty();
    }

    @Test
    @WithMockUser(username="test-admin", roles="ADMIN")
    void missingLeadCannotBeScored() {
        assertThatThrownBy(() -> qualification.qualify(UUID.randomUUID()))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("404");
    }

    @Test
    @WithMockUser(username="staff", roles="SOURCING")
    void sourcingRoleCannotReadLeadQualification() {
        assertThatThrownBy(() -> qualification.qualify(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
    }
}
