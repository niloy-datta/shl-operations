package com.shl.operations;

import com.shl.operations.contacts.ContactInput;
import com.shl.operations.contacts.Customer;
import com.shl.operations.contacts.CustomerRepository;
import com.shl.operations.contacts.Supplier;
import com.shl.operations.contacts.SupplierRepository;
import com.shl.operations.trading.RfqItemsController;
import com.shl.operations.trading.TradingController;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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
class RfqItemsWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry registry) {
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }

    @Autowired CustomerRepository customers;
    @Autowired SupplierRepository suppliers;
    @Autowired TradingController rfqs;
    @Autowired RfqItemsController items;

    private UUID newRfq() {
        var buyer=customers.save(new Customer(new ContactInput(
            "Structured buyer "+UUID.randomUUID(),"buyer@example.test",null,"DE")));
        return rfqs.create(new TradingController.RfqInput(
            buyer.id,"Industrial multi-grade materials","Specs will be attached as lines",
            new BigDecimal("10.000"),"PCS","USD",null
        )).getBody().id();
    }

    private RfqItemsController.ItemInput item(String name,String qty,String unit) {
        return new RfqItemsController.ItemInput(name,"Grade A36; size 3m x 12m",
            "7208",new BigDecimal(qty),unit,"Thickness +/- 0.2mm",
            "China","La Guaira, Venezuela");
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void requirementLinesAreEditableBeforeOfferAndFrozenAfterFirstOffer() {
        UUID id=newRfq();
        assertThat(items.list(id)).isEmpty();
        var first=items.add(id,item("Steel plate","9.000","PCS"));
        assertThat(first.lineNumber()).isEqualTo(1);
        assertThat(first.hsCode()).isEqualTo("7208");
        assertThat(items.list(id)).hasSize(1);

        rfqs.changeStatus(id,new TradingController.StatusInput("SOURCING"));
        Supplier seller=suppliers.save(new Supplier(new ContactInput(
            "Structured supplier "+UUID.randomUUID(),"seller@example.test",null,"CN")));

        var offer=new TradingController.OfferInput(
            seller.id,new BigDecimal("49.50"),new BigDecimal("1"),20,"FOB Shanghai");
        assertThatThrownBy(()->rfqs.saveOffer(id,offer))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("quantity/unit");

        var corrected=items.update(id,first.id(),item("Steel plate","10.000","PCS"));
        assertThat(corrected.quantity()).isEqualByComparingTo("10.000");
        rfqs.saveOffer(id,offer);

        assertThatThrownBy(()->items.update(id,first.id(),item("Revised plate","11","PCS")))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->items.delete(id,first.id()))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->items.add(id,item("Post-offer addition","2","PCS")))
            .isInstanceOf(ResponseStatusException.class);

        assertThat(rfqs.changeStatus(id,
            new TradingController.StatusInput("READY_FOR_QUOTE")).status())
            .isEqualTo("READY_FOR_QUOTE");
        assertThat(items.list(id)).hasSize(1);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void multiItemRfqsDoNotSilentlyConvertToSingleLineCommercialQuotes() {
        UUID id=newRfq();
        var first=items.add(id,item("Base steel plate","10","PCS"));
        var second=items.add(id,item("Coated steel coil","50","MT"));
        assertThat(items.list(id)).extracting(RfqItemsController.ItemRow::lineNumber)
            .containsExactly(1,2);

        rfqs.changeStatus(id,new TradingController.StatusInput("SOURCING"));
        Supplier seller=suppliers.save(new Supplier(new ContactInput(
            "Multi-line vendor "+UUID.randomUUID(),"vendor@example.test",null,"CN")));
        var quote=new TradingController.OfferInput(
            seller.id,new BigDecimal("30.00"),new BigDecimal("5"),10,null);
        assertThatThrownBy(()->rfqs.saveOffer(id,quote))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("per line");
        assertThat(items.list(id)).hasSize(2);
        // A multi-item request cannot proceed to commercial approval; the lines
        // remain editable without a misleading aggregate supplier quotation.
        assertThatThrownBy(()->rfqs.changeStatus(id,
            new TradingController.StatusInput("READY_FOR_QUOTE")))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Multi-item RFQ");
        items.delete(id,second.id());
        assertThat(items.list(id)).hasSize(1);
        rfqs.saveOffer(id,quote);
        assertThat(rfqs.changeStatus(id,new TradingController.StatusInput(
            "READY_FOR_QUOTE")).status()).isEqualTo("READY_FOR_QUOTE");
        assertThat(first.productName()).isEqualTo("Base steel plate");
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void deletionIsScopedAndLineNumbersCanBeReusedBeforeOffers() {
        UUID one=newRfq();
        UUID two=newRfq();
        var first=items.add(one,item("A","10","PCS"));
        var other=items.add(two,item("B","10","PCS"));
        assertThatThrownBy(()->items.delete(one,other.id()))
            .isInstanceOf(ResponseStatusException.class);
        items.delete(one,first.id());
        assertThat(items.list(one)).isEmpty();
        assertThat(items.add(one,item("Revised A","10","PCS")).lineNumber())
            .isEqualTo(1);
        assertThat(items.list(two)).hasSize(1);
    }

    @Test
    @WithMockUser(username="finance-only",roles="FINANCE")
    void financeRoleCannotReadOrEditRestrictedSourcingLines() {
        assertThatThrownBy(()->items.list(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->items.add(UUID.randomUUID(),item("Unauthorized","10","PCS")))
            .isInstanceOf(AccessDeniedException.class);
    }
}
