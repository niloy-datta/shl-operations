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
class RfqLineOffersWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry r) {
        r.add("DB_URL",postgres::getJdbcUrl);
        r.add("DB_USERNAME",postgres::getUsername);
        r.add("DB_PASSWORD",postgres::getPassword);
    }

    @Autowired CustomerRepository customers;
    @Autowired SupplierRepository suppliers;
    @Autowired TradingController rfqs;
    @Autowired RfqItemsController items;
    @Autowired RfqLineOffersController prices;
    @Autowired JdbcTemplate db;

    private UUID newInquiry() {
        var customer=customers.save(new Customer(new ContactInput(
            "Line quote customer "+UUID.randomUUID(),"buyer@example.test",null,"BD")));
        return rfqs.create(new TradingController.RfqInput(customer.id,
            "Multi-item buying request","Industrial metal components",
            new BigDecimal("10.000"),"PCS","USD",null)).getBody().id();
    }
    private UUID newSupplier() {
        return suppliers.save(new Supplier(new ContactInput(
            "Quotation supplier "+UUID.randomUUID(),"quotes@example.test",null,"CN"))).id;
    }
    private UUID addItem(UUID rfqId,String name,String qty,String unit) {
        return items.add(rfqId,new RfqItemsController.ItemInput(
            name,"Specification verified","7208",new BigDecimal(qty),unit,null,
            "China","Shanghai")).id();
    }
    private RfqLineOffersController.NewRevision revise(UUID item,UUID supplier,String price) {
        return new RfqLineOffersController.NewRevision(item,supplier,new BigDecimal(price),
            new BigDecimal("2.000"),14,"FOB","Shanghai","Valid for 14 days");
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void priceRevisionsAreAppendOnlyLatestIsCorrectAndItemsFreeze() {
        UUID rfqId=newInquiry();
        UUID first=addItem(rfqId,"Steel plate","10.000","PCS");
        UUID second=addItem(rfqId,"Steel coil","5.000","MT");
        UUID supplier=newSupplier();
        rfqs.changeStatus(rfqId,new TradingController.StatusInput("SOURCING"));

        var a=prices.add(rfqId,revise(first,supplier,"525.00"));
        var b=prices.add(rfqId,revise(first,supplier,"499.50"));
        var c=prices.add(rfqId,revise(second,supplier,"615.00"));

        assertThat(a.revisionNumber()).isEqualTo(1);
        assertThat(b.revisionNumber()).isEqualTo(2);
        assertThat(c.revisionNumber()).isEqualTo(1);
        assertThat(prices.latest(rfqId)).hasSize(2);
        assertThat(prices.latest(rfqId)).anySatisfy(p->{
            assertThat(p.itemId()).isEqualTo(first);
            assertThat(p.unitPrice()).isEqualByComparingTo("499.50");
            assertThat(p.supplierName()).contains("Quotation supplier");
        });
        assertThat(prices.history(rfqId,first)).extracting(
            RfqLineOffersController.PriceRow::revisionNumber).containsExactly(2,1);

        assertThatThrownBy(()->items.update(rfqId,first,
            new RfqItemsController.ItemInput("Changed",null,null,
                new BigDecimal("10"),"PCS",null,null,null)))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->items.delete(rfqId,second))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->rfqs.saveOffer(rfqId,new TradingController.OfferInput(
            supplier,new BigDecimal("1"),new BigDecimal("1"),5,null)))
            .isInstanceOf(ResponseStatusException.class);

        Long persisted=db.queryForObject(
            "SELECT count(*) FROM rfq_line_offer_revisions WHERE rfq_id=?",
            Long.class,rfqId);
        assertThat(persisted).isEqualTo(3);
        assertThatThrownBy(()->db.update(
            "UPDATE rfq_line_offer_revisions SET unit_price=1 WHERE id=?",a.id()))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(()->db.update(
            "DELETE FROM rfq_line_offer_revisions WHERE id=?",a.id()))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void unknownAndForeignRequirementsAreRejectedWithoutPartialWrites() {
        UUID rfq1=newInquiry();
        UUID rfq2=newInquiry();
        UUID fromOtherRfq=addItem(rfq2,"Foreign line","10","PCS");
        UUID supplier=newSupplier();
        rfqs.changeStatus(rfq1,new TradingController.StatusInput("SOURCING"));
        assertThatThrownBy(()->prices.add(rfq1,revise(fromOtherRfq,supplier,"99")))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(prices.latest(rfq1)).isEmpty();
        assertThatThrownBy(()->prices.history(rfq1,fromOtherRfq))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void newRevisionsRequireSourcingState() {
        UUID rfqId=newInquiry();
        UUID item=addItem(rfqId,"Industrial part","10","PCS");
        UUID supplier=newSupplier();
        assertThatThrownBy(()->prices.add(rfqId,revise(item,supplier,"50")))
            .isInstanceOf(ResponseStatusException.class);
        rfqs.changeStatus(rfqId,new TradingController.StatusInput("SOURCING"));
        prices.add(rfqId,revise(item,supplier,"50"));
        assertThatThrownBy(()->rfqs.changeStatus(rfqId,
            new TradingController.StatusInput("READY_FOR_QUOTE")))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="finance",roles="FINANCE")
    void financeCannotReadOrWriteSupplierSourcingRevisions() {
        assertThatThrownBy(()->prices.latest(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->prices.add(UUID.randomUUID(),
            revise(UUID.randomUUID(),UUID.randomUUID(),"1")))
            .isInstanceOf(AccessDeniedException.class);
    }
}
