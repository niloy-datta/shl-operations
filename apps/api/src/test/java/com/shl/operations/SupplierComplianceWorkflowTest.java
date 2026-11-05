package com.shl.operations;

import com.shl.operations.contacts.*;
import com.shl.operations.enterprise.SupplierComplianceController;
import java.time.LocalDate;
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
import org.springframework.security.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"
})
class SupplierComplianceWorkflowTest
{
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static
    {
        postgres.start();
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry)
    {
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }

    @Autowired SupplierRepository suppliers;
    @Autowired SupplierComplianceController compliance;
    @Autowired JdbcTemplate db;

    private UUID supplier()
    {
        return suppliers.save(new Supplier(new ContactInput(
            "Compliance vendor "+UUID.randomUUID(),"supplier@example.test",null,"CN"))).id;
    }

    private static void as(String name,String role,Runnable action)
    {
        var context=SecurityContextHolder.getContext();
        var previous=context.getAuthentication();
        try
        {
            context.setAuthentication(new UsernamePasswordAuthenticationToken(
                name,null,List.of(new SimpleGrantedAuthority("ROLE_"+role))));
            action.run();
        }
        finally
        {
            context.setAuthentication(previous);
        }
    }

    @Test
    @WithMockUser(username="sourcing-owner",roles="SOURCING")
    void reviewIsIndependentImmutableAndExpiryAware()
    {
        UUID supplierId=supplier();
        var created=compliance.submit(supplierId,new SupplierComplianceController.EvidenceInput(
            "TRADE_LICENSE","Register-123",LocalDate.now().minusDays(8),
            LocalDate.now().plusDays(2),"Supplier-provided reference")).getBody();
        assertThat(created).isNotNull();
        UUID evidenceId=(UUID)created.get("id");
        assertThat(compliance.list(supplierId,0,20).content()).hasSize(1);
        assertThat(compliance.list(supplierId,0,20).content().getFirst()
            .get("effective_status")).isEqualTo("PENDING");
        assertThatThrownBy(()->compliance.review(supplierId,evidenceId,
            new SupplierComplianceController.ReviewInput("APPROVED","Own review")))
            .isInstanceOf(AccessDeniedException.class);
        as("different-manager","MANAGEMENT",()->
        {
            assertThat(compliance.review(supplierId,evidenceId,
                new SupplierComplianceController.ReviewInput(
                    "APPROVED","Internal reference reviewed")).get("decision"))
                .isEqualTo("APPROVED");
            assertThatThrownBy(()->compliance.review(supplierId,evidenceId,
                new SupplierComplianceController.ReviewInput("REJECTED","Repeat")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        });
        assertThat(compliance.list(supplierId,0,20).content().getFirst()
            .get("effective_status")).isEqualTo("APPROVED");
        assertThat(db.queryForObject("""
            SELECT count(*) FROM audit_events
            WHERE entity_id=? AND action='EVIDENCE_REVIEWED'
            """,Integer.class,supplierId)).isEqualTo(1);
        assertThatThrownBy(()->db.update(
            "DELETE FROM supplier_compliance_evidence WHERE id=?",evidenceId))
            .isInstanceOf(org.springframework.dao.DataAccessException.class)
            .hasMessageContaining("append-only");
    }

    @Test
    @WithMockUser(username="operator",roles="SOURCING")
    void expiredReferencesCannotBeApprovedAndIssueDatesAreValidated()
    {
        UUID supplierId=supplier();
        assertThatThrownBy(()->compliance.submit(supplierId,
            new SupplierComplianceController.EvidenceInput(
                "OTHER","Invalid",LocalDate.now(),LocalDate.now().minusDays(1),null)))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        UUID id=(UUID)compliance.submit(supplierId,
            new SupplierComplianceController.EvidenceInput(
                "INSURANCE","Old policy",null,LocalDate.now().minusDays(1),null))
            .getBody().get("id");
        as("auditor","MANAGEMENT",()->
        {
            assertThatThrownBy(()->compliance.review(supplierId,id,
                new SupplierComplianceController.ReviewInput(
                    "APPROVED","Would be stale")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
            compliance.review(supplierId,id,
                new SupplierComplianceController.ReviewInput(
                    "REJECTED","Expired reference"));
        });
        assertThat(compliance.list(supplierId,0,20).content().getFirst()
            .get("effective_status")).isEqualTo("REJECTED");
    }

    @Test
    @WithMockUser(username="finance-user",roles="FINANCE")
    void financeCannotReadOrSubmitComplianceData()
    {
        assertThatThrownBy(()->compliance.list(UUID.randomUUID(),0,20))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->compliance.submit(UUID.randomUUID(),
            new SupplierComplianceController.EvidenceInput(
                "OTHER","Ref",null,null,null)))
            .isInstanceOf(AccessDeniedException.class);
    }
}
