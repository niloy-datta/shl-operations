package com.shl.operations;

import com.shl.operations.contacts.*;
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

    @Test void recordsPersistAndSearchByName() {
        String suffix = java.util.UUID.randomUUID().toString();
        Customer customer = customers.save(new Customer(new ContactInput("Customer " + suffix, "customer@example.test", "123", "BD")));
        Supplier supplier = suppliers.save(new Supplier(new ContactInput("Supplier " + suffix, "supplier@example.test", "456", "CN")));
        assertThat(customers.findById(customer.id)).isPresent();
        assertThat(suppliers.findById(supplier.id)).isPresent();
        assertThat(customers.findByNameContainingIgnoreCase(suffix, org.springframework.data.domain.PageRequest.of(0, 10)).getTotalElements()).isEqualTo(1);
    }
}

