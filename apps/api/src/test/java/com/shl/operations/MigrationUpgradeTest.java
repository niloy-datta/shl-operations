package com.shl.operations;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

class MigrationUpgradeTest {
    @Test
    void existingV20RecordsSurviveTheIntegratedMigrationChain() {
        try (var postgres = new PostgreSQLContainer("postgres:17.6")) {
            postgres.start();
            var source = new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
            var baseline = Flyway.configure().dataSource(source).target("20").load();
            baseline.migrate();
            var db = new JdbcTemplate(source);
            UUID customer = UUID.randomUUID();
            db.update("INSERT INTO customers(id,name) VALUES (?,?)", customer, "Synthetic upgrade test");

            var integrated = Flyway.configure().dataSource(source).load();
            var upgrade = integrated.migrate();
            assertThat(upgrade.migrationsExecuted).isEqualTo(6);
            integrated.validate();
            assertThat(integrated.info().applied()).hasSize(26);
            assertThat(db.queryForObject("SELECT name FROM customers WHERE id=?", String.class, customer))
                .isEqualTo("Synthetic upgrade test");
            assertThat(db.queryForObject("SELECT count(*) FROM crm_lead_contact_consents", Integer.class)).isZero();
            assertThat(integrated.migrate().migrationsExecuted).isZero();
        }
    }
}
