package com.shl.operations;

import com.shl.operations.enterprise.GrowthController;
import com.shl.operations.enterprise.LeadConsentController;
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

@SpringBootTest(properties = {
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"
})
class LeadConsentWorkflowTest
{
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.6");
    static
    {
        postgres.start();
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry)
    {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }

    @Autowired GrowthController growth;
    @Autowired LeadConsentController consent;
    @Autowired JdbcTemplate db;

    private UUID lead()
    {
        String suffix = UUID.randomUUID().toString();
        return (UUID) growth.addLead(new GrowthController.LeadInput(
            null, "Buyer " + suffix, "Contact", null, "MANUAL",
            "Consent test " + suffix, null, null, null)).getBody().get("id");
    }

    @Test
    @WithMockUser(username="test-admin", roles="ADMIN")
    void recordsRevocationAndKeepsAppendOnlyAuditHistory()
    {
        UUID id = lead();
        assertThat(consent.list(id).current()).isEmpty();
        consent.record(id, new LeadConsentController.ConsentInput(
            "EMAIL", "FOLLOW_UP", "GRANTED", "Buyer requested updates on a call"));
        assertThat(consent.list(id).current()).hasSize(1);
        assertThat(consent.list(id).current().getFirst().get("decision")).isEqualTo("GRANTED");
        assertThatThrownBy(() -> consent.record(id, new LeadConsentController.ConsentInput(
            "EMAIL", "FOLLOW_UP", "GRANTED", "Duplicate")))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409");

        consent.record(id, new LeadConsentController.ConsentInput(
            "EMAIL", "FOLLOW_UP", "REVOKED", "Buyer opted out during call"));
        var updated = consent.list(id);
        assertThat(updated.current()).hasSize(1);
        assertThat(updated.current().getFirst().get("decision")).isEqualTo("REVOKED");
        assertThat(updated.history()).hasSize(2);
        assertThat(db.queryForObject("""
            SELECT count(*) FROM audit_events
            WHERE entity_id=? AND action='CONTACT_PREFERENCE_RECORDED'
            """, Integer.class, id)).isEqualTo(2);
        assertThatThrownBy(() -> db.update(
            "DELETE FROM crm_lead_contact_consents WHERE lead_id=?", id))
            .isInstanceOf(Exception.class)
            .hasMessageContaining("append-only");
    }

    @Test
    @WithMockUser(username="test-admin", roles="ADMIN")
    void missingLeadInvalidInputAndClosedLeadAreProtected()
    {
        UUID missing = UUID.randomUUID();
        assertThatThrownBy(() -> consent.list(missing))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
        UUID id = lead();
        assertThatThrownBy(() -> consent.record(id, new LeadConsentController.ConsentInput(
            "SMS", "FOLLOW_UP", "GRANTED", "Not supported")))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        growth.leadStatus(id, new GrowthController.ChangeStatus("LOST"));
        assertThatThrownBy(() -> consent.record(id, new LeadConsentController.ConsentInput(
            "EMAIL", "MARKETING", "GRANTED", "Invalid on closed lead")))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        consent.record(id, new LeadConsentController.ConsentInput(
            "EMAIL", "MARKETING", "REVOKED", "Opt-out remains possible"));
        assertThat(consent.list(id).current()).hasSize(1);
    }

    @Test
    @WithMockUser(username="bd-user", roles="BD")
    void businessDevelopmentCanRecordButCannotEraseHistory()
    {
        UUID id = lead();
        consent.record(id, new LeadConsentController.ConsentInput(
            "WECHAT", "FOLLOW_UP", "REVOKED", "Prospect requested no contact"));
        assertThat(consent.list(id).history()).hasSize(1);
    }

    @Test
    @WithMockUser(username="sourcing-user", roles="SOURCING")
    void sourcingCannotAccessLeadPreferences()
    {
        assertThatThrownBy(() -> consent.list(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> consent.record(UUID.randomUUID(),
            new LeadConsentController.ConsentInput(
                "EMAIL", "FOLLOW_UP", "GRANTED", "Untrusted")))
            .isInstanceOf(AccessDeniedException.class);
    }
}
