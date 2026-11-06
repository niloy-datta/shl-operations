package com.shl.operations;

import com.shl.operations.trading.TruckProductController;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"BOOTSTRAP_ADMIN_USERNAME=test-admin","BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"})
class TruckProductWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static {postgres.start();}
    @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("DB_URL",postgres::getJdbcUrl);r.add("DB_USERNAME",postgres::getUsername);r.add("DB_PASSWORD",postgres::getPassword);}
    @Autowired TruckProductController products;
    @Autowired JdbcTemplate db;

    private TruckProductController.ProductInput input(){
        UUID category=db.queryForObject("SELECT id FROM truck_product_categories WHERE slug='fuel-tanker'",UUID.class);
        return new TruckProductController.ProductInput(category,null,"TEST-1","Test Tanker",null,"Test only",
            List.of(new TruckProductController.SpecInput("tank_capacity","Tank capacity","10000","L")),
            List.of("Test application"),List.of("6x4"),List.of(new TruckProductController.MarketNote("BD","Test market note")),
            List.of(new TruckProductController.DocumentRef("Source","https://example.test/spec.pdf","application/pdf")),List.of());
    }

    @Test @WithMockUser(username="catalog_editor",roles="SOURCING")
    void createsSearchesAndEditsDraftProductWithAuditableStructuredDetails(){
        var created=products.create(input());
        assertThat(created.status()).isEqualTo("DRAFT");
        var detail=products.detail(created.id());
        assertThat(detail.specifications()).hasSize(1);
        assertThat(detail.applications()).containsExactly("Test application");
        assertThat(detail.marketNotes()).hasSize(1);
        assertThat(products.list("Test Tanker",null,"DRAFT","modelName","asc",0,20).totalElements()).isGreaterThanOrEqualTo(1);
        var changed=new TruckProductController.ProductInput(input().categoryId(),null,"TEST-1","Updated Test Tanker",null,
            "Updated",input().specifications(),input().applications(),input().configurations(),input().marketNotes(),input().documents(),List.of());
        assertThat(products.update(created.id(),changed).modelName()).isEqualTo("Updated Test Tanker");
        assertThat(products.history(created.id())).extracting(TruckProductController.HistoryRow::action)
            .contains("CREATED","UPDATED");
    }

    @Test @WithMockUser(username="catalog_editor",roles="MANAGEMENT")
    void creatorCannotApproveOwnProductAndActiveProductIsReadOnly(){
        var created=products.create(input());
        assertThatThrownBy(()->products.approve(created.id())).isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("cannot approve their own");
    }

    @Test @WithMockUser(username="independent_reviewer",roles="MANAGEMENT")
    void independentManagerApprovesAndArchivesProduct(){
        var input=input();UUID id=UUID.randomUUID();
        db.update("INSERT INTO truck_products(id,category_id,model_name,created_by) VALUES(?,?,?,?)",id,input.categoryId(),"Approval test","catalog_editor");
        db.update("INSERT INTO truck_product_spec_values(product_id,field_key,label,value) VALUES(?,?,?,?)",id,"test_spec","Test specification","source entered");
        assertThat(products.approve(id).status()).isEqualTo("ACTIVE");
        assertThatThrownBy(()->products.update(id,input)).isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Only draft products can be edited");
        assertThat(products.archive(id).status()).isEqualTo("ARCHIVED");
        assertThat(products.history(id)).extracting(TruckProductController.HistoryRow::action).contains("APPROVED","ARCHIVED");
    }

    @Test @WithMockUser(username="finance_user",roles="FINANCE")
    void financeRoleCannotReadTruckCatalog(){assertThatThrownBy(products::categories).isInstanceOf(AccessDeniedException.class);}
}
