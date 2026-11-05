package com.shl.operations;

import com.shl.operations.enterprise.GrowthController;
import com.shl.operations.enterprise.LeadConversionController;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
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
class LeadConversionWorkflowTest
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
    @Autowired LeadConversionController conversion;
    @Autowired JdbcTemplate db;

    private UUID lead()
    {
        String suffix = UUID.randomUUID().toString();
        UUID id = (UUID) growth.addLead(new GrowthController.LeadInput(
            null, "Buyer " + suffix, "Contact", "buyer@example.test", "MANUAL",
            "Industrial freight " + suffix, "Lead details", null, null)).getBody().get("id");
        growth.leadStatus(id,new GrowthController.ChangeStatus("QUALIFIED"));
        growth.leadStatus(id,new GrowthController.ChangeStatus("WON"));
        return id;
    }

    private UUID customer()
    {
        UUID id = UUID.randomUUID();
        db.update("INSERT INTO customers(id,name) VALUES(?,?)",id,"Conversion buyer " + id);
        return id;
    }

    private UUID adminId()
    {
        return db.queryForObject("SELECT id FROM staff_users WHERE username='test-admin'",UUID.class);
    }

    private LeadConversionController.ConversionInput input(UUID customer)
    {
        return new LeadConversionController.ConversionInput(
            customer,adminId(),new BigDecimal("12.500"),"MT","USD",null,
            "Contract preparation",null,null,"Checked buyer identity and terms");
    }

    private void asIndependentManager(Runnable runnable)
    {
        var context = SecurityContextHolder.getContext();
        var original = context.getAuthentication();
        try
        {
            context.setAuthentication(new UsernamePasswordAuthenticationToken(
                "independent-manager",null,
                List.of(new SimpleGrantedAuthority("ROLE_MANAGEMENT"))));
            runnable.run();
        }
        finally
        {
            context.setAuthentication(original);
        }
    }

    @Test
    @WithMockUser(username="test-admin", roles="ADMIN")
    void reviewedConversionLinksExactlyOneCustomerRfqAndProjectAndCanBeSafelyRetried()
    {
        UUID id = lead();
        UUID customerId = customer();
        var request = input(customerId);
        assertThatThrownBy(() -> conversion.convert(id,request))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409");

        asIndependentManager(() ->
        {
            var first = conversion.convert(id,request);
            assertThat(first.getStatusCode().value()).isEqualTo(201);
            var refs = first.getBody();
            assertThat(refs).isNotNull();
            assertThat(conversion.get(id).rfqId()).isEqualTo(refs.rfqId());
            assertThat(conversion.get(id).projectId()).isEqualTo(refs.projectId());
            assertThat(db.queryForObject("SELECT customer_id FROM crm_leads WHERE id=?",
                UUID.class,id)).isEqualTo(customerId);
            assertThat(db.queryForObject("SELECT count(*) FROM rfqs WHERE id=?",
                Integer.class,refs.rfqId())).isEqualTo(1);
            assertThat(db.queryForObject("""
                SELECT count(*) FROM business_projects
                WHERE id=? AND lead_id=? AND customer_id=?
                """,Integer.class,refs.projectId(),id,customerId)).isEqualTo(1);
            assertThat(conversion.convert(id,request).getStatusCode().value()).isEqualTo(200);
            assertThatThrownBy(() -> conversion.convert(id,input(customer())))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
        });
        assertThat(db.queryForObject(
            "SELECT count(*) FROM crm_lead_conversions WHERE lead_id=?",
            Integer.class,id)).isEqualTo(1);
        assertThat(db.queryForObject("""
            SELECT count(*) FROM audit_events
            WHERE entity_id=? AND action='LEAD_CONVERTED'
            """,Integer.class,id)).isEqualTo(1);
        assertThatThrownBy(() -> db.update(
            "DELETE FROM crm_lead_conversions WHERE lead_id=?",id))
            .isInstanceOf(Exception.class)
            .hasMessageContaining("immutable");
    }

    @Test
    @WithMockUser(username="test-admin", roles="ADMIN")
    void invalidLinkedCustomerCannotBeReassigned()
    {
        UUID existingCustomer = customer();
        UUID id = (UUID)growth.addLead(new GrowthController.LeadInput(
            existingCustomer,"Customer","Contact",null,"MANUAL",
            "New RFQ",null,null,null)).getBody().get("id");
        growth.leadStatus(id,new GrowthController.ChangeStatus("QUALIFIED"));
        growth.leadStatus(id,new GrowthController.ChangeStatus("WON"));
        asIndependentManager(() -> assertThatThrownBy(
            () -> conversion.convert(id,input(customer())))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409"));
        assertThat(db.queryForObject("SELECT count(*) FROM crm_lead_conversions WHERE lead_id=?",
            Integer.class,id)).isZero();
    }

    @Test
    @WithMockUser(username="bd-user", roles="BD")
    void businessDevelopmentCannotBypassIndependentReview()
    {
        assertThatThrownBy(() -> conversion.get(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> conversion.convert(UUID.randomUUID(),
            new LeadConversionController.ConversionInput(
                UUID.randomUUID(),UUID.randomUUID(),new BigDecimal("1"),"PCS","USD",
                null,"Test",null,null,"Unapproved")))
            .isInstanceOf(AccessDeniedException.class);
    }
}
