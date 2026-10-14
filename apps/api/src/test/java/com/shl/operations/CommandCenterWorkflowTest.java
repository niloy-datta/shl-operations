package com.shl.operations;

import com.shl.operations.enterprise.CommandCenterController;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"
})
class CommandCenterWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static {postgres.start();}
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry){
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired CommandCenterController controller;

    @Test
    @WithMockUser(username="manager",roles="MANAGEMENT")
    void exposesDatabaseGroundedNonSensitiveAggregates() {
        Map<String,Object> summary=controller.summary();
        assertThat(summary.get("asOfUtc")).isEqualTo(LocalDate.now(java.time.ZoneOffset.UTC).toString());
        assertThat(summary).containsKeys("customers","suppliers","leadsActive","leadsWon",
            "rfqsOpen","salesOpen","projectsActive","projectsOverdue","shipmentsTransit",
            "shipmentsLate","tasksOverdue","invoicesOverdue","outstandingByCurrency",
            "nextShipments","nextTasks");
        assertThat((Long)summary.get("shipmentsTransit")).isGreaterThanOrEqualTo(0L);
        assertThat((List<?>)summary.get("nextShipments")).hasSizeLessThanOrEqualTo(6);
        assertThat(summary).doesNotContainKeys("commissions","commissionTotal",
            "commissionBeneficiaries","commissionRate");
    }
    @Test
    @WithMockUser(username="bd",roles="BD")
    void preventsOrdinaryStaffFromAccessingExecutiveReports() {
        assertThatThrownBy(()->controller.summary()).isInstanceOf(AccessDeniedException.class);
    }
}
