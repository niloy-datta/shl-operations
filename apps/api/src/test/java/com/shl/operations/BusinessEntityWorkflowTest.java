package com.shl.operations;

import com.shl.operations.contacts.*;
import com.shl.operations.enterprise.BusinessEntityController;
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
class BusinessEntityWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static {postgres.start();}
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry){
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired CustomerRepository customers;
    @Autowired SupplierRepository suppliers;
    @Autowired BusinessEntityController entities;

    private BusinessEntityController.EntityInput entry(UUID customer,UUID supplier,
        String type,String name) {
        return new BusinessEntityController.EntityInput(type,customer,supplier,
            name,"European branch","NL","Rotterdam","https://example.test","REG-123","ACTIVE");
    }
    private BusinessEntityController.ContactInput person(String role,boolean primary) {
        return new BusinessEntityController.ContactInput("Jane Doe","Procurement Lead",
            role,"jane@example.test",null,primary,true);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void persistsCompanyBranchesAndVersionableRoleContacts() {
        var buyer=customers.save(new Customer(new ContactInput(
            "Corporate buyer "+UUID.randomUUID(),"customer@example.test",null,"NL")));
        var seller=suppliers.save(new Supplier(new ContactInput(
            "Corporate supplier "+UUID.randomUUID(),"supplier@example.test",null,"CN")));
        var created=entities.create(entry(buyer.id,null,"CUSTOMER","EU Buyer BV")).getBody();
        UUID id=(UUID)created.get("id");
        assertThat(created.get("reference")).asString().startsWith("ENT-");
        assertThat(entities.list("EU Buyer",0,10).content())
            .anyMatch(r->id.equals(r.get("id")));
        assertThatThrownBy(()->entities.update(id,entry(null,seller.id,"SUPPLIER","Wrong Owner")))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->entities.create(entry(buyer.id,seller.id,"CUSTOMER","Mixed owner")))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->entities.create(new BusinessEntityController.EntityInput(
            "PARTNER",null,null,"Fake country",null,"ZZ",null,null,null,"ACTIVE")))
            .isInstanceOf(ResponseStatusException.class);
        var contact=entities.addContact(id,person("BUYING",true)).getBody();
        UUID contactId=(UUID)contact.get("id");
        assertThat(entities.contacts(id,0,20).content()).anyMatch(r->contactId.equals(r.get("id")));
        assertThatThrownBy(()->entities.addContact(id,person("BUYING",true)))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        var update=new BusinessEntityController.ContactInput("Jane Doe","Finance",
            "FINANCE","jane@example.test",null,false,true);
        assertThat(entities.updateContact(id,contactId,update).get("contact_role")).isEqualTo("FINANCE");
        assertThatThrownBy(()->entities.addContact(id,person("UNKNOWN",false)))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(entities.update(id,new BusinessEntityController.EntityInput(
            "CUSTOMER",buyer.id,null,"EU Buyer BV","New branch","NL","Amsterdam",
            "https://example.test",null,"INACTIVE")).get("status")).isEqualTo("INACTIVE");
    }

    @Test
    @WithMockUser(username="finance",roles="FINANCE")
    void financeCannotSeeRestrictedBusinessContactDirectory() {
        assertThatThrownBy(()->entities.list("",0,10))
            .isInstanceOf(AccessDeniedException.class);
    }
    @Test
    @WithMockUser(username="bd",roles="BD")
    void bdMayReadButNotProvisionCorporateRegistry() {
        assertThat(entities.list("",0,5)).isNotNull();
        assertThatThrownBy(()->entities.create(new BusinessEntityController.EntityInput(
            "PARTNER",null,null,"New partner",null,"CN",null,null,null,"ACTIVE")))
            .isInstanceOf(AccessDeniedException.class);
    }
}
