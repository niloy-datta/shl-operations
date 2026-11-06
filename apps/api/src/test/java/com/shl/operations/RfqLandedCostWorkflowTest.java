package com.shl.operations;

import com.shl.operations.contacts.*;
import com.shl.operations.trading.*;
import java.math.BigDecimal;
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
class RfqLandedCostWorkflowTest
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

    @Autowired CustomerRepository customers;
    @Autowired SupplierRepository suppliers;
    @Autowired TradingController trading;
    @Autowired RfqItemsController items;
    @Autowired RfqLineOffersController prices;
    @Autowired RfqLandedCostController landed;
    @Autowired JdbcTemplate db;

    private UUID inquiry()
    {
        var customer=customers.save(new Customer(new ContactInput(
            "Cost buyer "+UUID.randomUUID(),"buyer@example.test",null,"BD")));
        UUID rfqId=trading.create(new TradingController.RfqInput(
            customer.id,"Freight costing","Quoted line",
            new BigDecimal("10.000"),"MT","USD",null)).getBody().id();
        trading.changeStatus(rfqId,new TradingController.StatusInput("SOURCING"));
        return rfqId;
    }

    private UUID item(UUID rfqId)
    {
        return items.add(rfqId,new RfqItemsController.ItemInput(
            "Industrial product","Test specifications","7208",
            new BigDecimal("10.000"),"MT",null,"China","Bangladesh")).id();
    }

    private UUID supplier()
    {
        return suppliers.save(new Supplier(new ContactInput(
            "Cost supplier "+UUID.randomUUID(),"vendor@example.test",null,"CN"))).id;
    }

    private UUID quote(UUID rfqId,UUID itemId,UUID supplierId,String price)
    {
        return prices.add(rfqId,new RfqLineOffersController.NewRevision(
            itemId,supplierId,new BigDecimal(price),new BigDecimal("1.000"),
            20,"FOB","Qingdao","Quote source reference")).id();
    }

    private RfqLandedCostController.ScenarioInput scenario(UUID revisionId)
    {
        return new RfqLandedCostController.ScenarioInput(
            revisionId,new BigDecimal("50.00"),new BigDecimal("10.00"),
            new BigDecimal("25.00"),new BigDecimal("15.00"),
            "Freight forwarder estimate dated 2026-10-01, not yet reviewed");
    }

    @Test
    @WithMockUser(username="test-sourcing",roles="SOURCING")
    void scenariosPreserveSourceRevisionAndCalculateWithoutFx()
    {
        UUID rfqId=inquiry();
        UUID itemId=item(rfqId);
        UUID supplierId=supplier();
        UUID revision=quote(rfqId,itemId,supplierId,"100.0000");
        var created=landed.create(rfqId,scenario(revision)).getBody();
        assertThat(created).isNotNull();
        assertThat((BigDecimal)created.get("estimated_total"))
            .isEqualByComparingTo("1100.00");
        assertThat((BigDecimal)created.get("estimated_unit_cost"))
            .isEqualByComparingTo("110.0000");
        assertThat(((String)created.get("currency")).trim()).isEqualTo("USD");
        UUID id=(UUID)created.get("id");
        assertThat(landed.list(rfqId)).hasSize(1);
        assertThat(landed.list(rfqId).getFirst().get("source_revision_id"))
            .isEqualTo(revision);
        assertThat(db.queryForObject("""
            SELECT count(*) FROM audit_events WHERE entity_id=?
              AND action='LANDED_COST_ESTIMATED'
            """,Integer.class,rfqId)).isEqualTo(1);
        assertThatThrownBy(()->db.update(
            "DELETE FROM rfq_landed_cost_scenarios WHERE id=?",id))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
        quote(rfqId,itemId,supplierId,"99.0000");
        assertThatThrownBy(()->landed.create(rfqId,scenario(revision)))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThat(landed.list(rfqId)).hasSize(1);
    }

    @Test
    @WithMockUser(username="test-sourcing",roles="SOURCING")
    void unrelatedRevisionAndClosedRfqCannotBeCosted()
    {
        UUID rfqId=inquiry();
        item(rfqId);
        assertThatThrownBy(()->landed.create(rfqId,scenario(UUID.randomUUID())))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
        UUID another=inquiry();
        UUID line=item(another);
        UUID id=quote(another,line,supplier(),"21.0000");
        assertThatThrownBy(()->landed.create(rfqId,scenario(id)))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }

    @Test
    @WithMockUser(username="test-bd",roles="BD")
    void bdMayReadButNotCreateCostAssumptions()
    {
        assertThatThrownBy(()->landed.create(UUID.randomUUID(),scenario(UUID.randomUUID())))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @WithMockUser(username="test-finance",roles="FINANCE")
    void financeCannotReadSourcingBreakdown()
    {
        assertThatThrownBy(()->landed.list(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
    }
}
