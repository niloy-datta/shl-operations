package com.shl.operations;

import com.shl.operations.contacts.*;
import com.shl.operations.enterprise.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
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
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456",
    "COMMISSION_AUTHORIZED_USERS=test-admin,independent-approver"
})
class FinanceControlTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static{postgres.start();}
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry){
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired CustomerRepository customers;
    @Autowired GrowthController growth;
    @Autowired ExpenseController expenses;
    @Autowired ConfidentialCommissionController commissions;
    @Autowired JdbcTemplate db;

    private UUID project(){
        var customer=customers.save(new Customer(new ContactInput(
            "Finance customer "+UUID.randomUUID(),"accounts@example.test",null,"CN")));
        UUID id=db.queryForObject("SELECT id FROM staff_users WHERE username='test-admin'",UUID.class);
        return (UUID)growth.addProject(new GrowthController.ProjectInput(
            customer.id,null,null,"Procurement and shipping project",null,id,
            LocalDate.now().plusDays(30))).getBody().get("id");
    }
    private void asApprover(Runnable action){
        var context=SecurityContextHolder.getContext();
        var original=context.getAuthentication();
        try{
            context.setAuthentication(new UsernamePasswordAuthenticationToken(
                "independent-approver",null,
                List.of(new SimpleGrantedAuthority("ROLE_MANAGEMENT"))));
            action.run();
        }finally{context.setAuthentication(original);}
    }
    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void expensesNeedIndependentApprovalAndPreserveCurrencyBuckets(){
        UUID projectId=project();
        UUID id=(UUID)expenses.create(new ExpenseController.Input(
            projectId,"FREIGHT","Ocean freight",new BigDecimal("240.00"),
            "USD",LocalDate.now())).getBody().get("id");
        assertThat(expenses.get(id).get("status")).isEqualTo("DRAFT");
        assertThatThrownBy(()->expenses.status(id,new ExpenseController.Status("APPROVED")))
            .isInstanceOf(ResponseStatusException.class);
        asApprover(()->expenses.status(id,new ExpenseController.Status("APPROVED")));
        assertThat(expenses.get(id).get("approved_by")).isEqualTo("independent-approver");
        assertThat(expenses.summary()).anyMatch(currency->"USD".equals(currency.get("currency").toString().trim()));
        assertThatThrownBy(()->expenses.status(id,new ExpenseController.Status("VOID")))
            .isInstanceOf(ResponseStatusException.class);
    }
    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void commissionsUseExplicitAllowlistCalculatedDecimalsAndPrivateAudit(){
        UUID projectId=project();
        UUID id=(UUID)commissions.create(new ConfidentialCommissionController.Input(
            projectId,"KEY_PERSON","Protected beneficiary",new BigDecimal("1250.00"),
            new BigDecimal("2.5000"),"USD")).getBody().get("id");
        assertThat((BigDecimal)commissions.get(id).get("commission_amount"))
            .isEqualByComparingTo(new BigDecimal("31.25"));
        assertThatThrownBy(()->commissions.status(id,
            new ConfidentialCommissionController.Status("APPROVED")))
            .isInstanceOf(ResponseStatusException.class);
        asApprover(()->commissions.status(id,
            new ConfidentialCommissionController.Status("APPROVED")));
        assertThat(commissions.get(id).get("approved_by")).isEqualTo("independent-approver");
        assertThat(commissions.history(id)).hasSize(2);
        Long leaked=db.queryForObject(
            "SELECT count(*) FROM audit_events WHERE entity_type='COMMISSION'",Long.class);
        assertThat(leaked).isZero();

        var ctx=SecurityContextHolder.getContext();var original=ctx.getAuthentication();
        try{
            ctx.setAuthentication(new UsernamePasswordAuthenticationToken(
                "ordinary-admin",null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
            assertThat(commissions.access()).containsEntry("allowed",false);
            assertThatThrownBy(()->commissions.list("",0,10))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e->assertThat(((ResponseStatusException)e).getStatusCode())
                    .isEqualTo(HttpStatus.FORBIDDEN));
            assertThatThrownBy(()->commissions.get(id))
                .isInstanceOf(ResponseStatusException.class);
        }finally{ctx.setAuthentication(original);}
    }
}
