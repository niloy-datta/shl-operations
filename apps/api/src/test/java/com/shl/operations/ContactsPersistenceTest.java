package com.shl.operations;

import com.shl.operations.contacts.*;
import com.shl.operations.trading.TradingController;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.springframework.web.server.ResponseStatusException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = { "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456" })
class ContactsPersistenceTest {
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }

    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }
    @Autowired CustomerRepository customers;
    @Autowired SupplierRepository suppliers;
    @Autowired TradingController trading;

    @Test void recordsPersistAndSearchByName() {
        String suffix = java.util.UUID.randomUUID().toString();
        Customer customer = customers.save(new Customer(new ContactInput("Customer " + suffix, "customer@example.test", "123", "BD")));
        Supplier supplier = suppliers.save(new Supplier(new ContactInput("Supplier " + suffix, "supplier@example.test", "456", "CN")));
        assertThat(customers.findById(customer.id)).isPresent();
        assertThat(suppliers.findById(supplier.id)).isPresent();
        assertThat(customers.findByNameContainingIgnoreCase(suffix, org.springframework.data.domain.PageRequest.of(0, 10)).getTotalElements()).isEqualTo(1);
    }
    @Test void rfqLifecycleLinksCustomersAndSupplierOffers() {
        String suffix = java.util.UUID.randomUUID().toString();
        Customer customer = customers.save(new Customer(
            new ContactInput("RFQ Buyer " + suffix, "buyer@example.test", null, "BD")));
        Supplier supplier = suppliers.save(new Supplier(
            new ContactInput("RFQ Supplier " + suffix, "seller@example.test", null, "CN")));

        var input = new TradingController.RfqInput(customer.id, "Steel plate enquiry",
            "ASTM A36, FOB China", new BigDecimal("150.000"), "MT", "USD", null);
        var created = trading.create(input);
        assertThat(created.getBody()).isNotNull();
        var id = created.getBody().id();
        assertThat(trading.get(id).customerId()).isEqualTo(customer.id);
        assertThat(trading.get(id).status()).isEqualTo("NEW");

        trading.changeStatus(id, new TradingController.StatusInput("SOURCING"));
        assertThatThrownBy(() -> trading.changeStatus(id,
            new TradingController.StatusInput("READY_FOR_QUOTE")))
            .isInstanceOf(ResponseStatusException.class);

        trading.saveOffer(id, new TradingController.OfferInput(supplier.id,
            new BigDecimal("620.5000"), new BigDecimal("10.000"), 35, "FOB Qingdao"));
        assertThat(trading.offers(id)).hasSize(1);
        assertThat(trading.offers(id).getFirst().supplierName()).contains("RFQ Supplier");
        trading.changeStatus(id, new TradingController.StatusInput("READY_FOR_QUOTE"));
        assertThatThrownBy(() -> trading.saveOffer(id, new TradingController.OfferInput(supplier.id,
            new BigDecimal("599.0000"), new BigDecimal("5.000"), 25, "Late revision")))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(trading.offers(id).getFirst().unitPrice())
            .isEqualByComparingTo(new BigDecimal("620.5000"));
        trading.changeStatus(id, new TradingController.StatusInput("CLOSED"));
        assertThat(trading.get(id).offerCount()).isEqualTo(1);
        assertThat(trading.history(id)).extracting(TradingController.ActivityRow::action)
            .contains("RFQ_CREATED", "OFFER_SAVED", "STATUS_CHANGED");
        assertThatThrownBy(() -> trading.saveOffer(id, new TradingController.OfferInput(supplier.id,
            new BigDecimal("615.0000"), new BigDecimal("10.000"), 31, null)))
            .isInstanceOf(ResponseStatusException.class);
    }

}

