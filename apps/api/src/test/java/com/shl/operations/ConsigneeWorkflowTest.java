package com.shl.operations;

import com.shl.operations.contacts.*;
import com.shl.operations.enterprise.*;
import com.shl.operations.trading.TradingController;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties = {
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"
})
class ConsigneeWorkflowTest {
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }
    @Autowired CustomerRepository customers;
    @Autowired SupplierRepository suppliers;
    @Autowired ConsigneeController consignees;
    @Autowired TradingController trading;
    @Autowired CommerceController commerce;
    @Autowired LogisticsController logistics;

    private ConsigneeController.Input profile(UUID customer, String name, boolean active) {
        return new ConsigneeController.Input(customer,name,"Receiving team",
            "receiving@example.test","+310000000000","NL","Warehouse 9, Rotterdam",active);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void directoryIsCustomerScopedAndMaintainsAudit() {
        UUID buyer = customers.save(new Customer(new ContactInput(
            "Consignee owner "+UUID.randomUUID(),"buyer@example.test",null,"NL"))).id;
        UUID another = customers.save(new Customer(new ContactInput(
            "Other consignee owner "+UUID.randomUUID(),"other@example.test",null,"NL"))).id;
        var saved=consignees.create(profile(buyer,"Rotterdam Receiving",true)).getBody();
        assertThat(saved).isNotNull();
        UUID id=(UUID)saved.get("id");
        assertThat(saved.get("code")).asString().startsWith("CNE-");
        assertThat(consignees.get(id).get("customer_id")).isEqualTo(buyer);
        assertThat(consignees.list("Rotterdam Receiving",0,10,buyer).content())
            .anyMatch(row->id.equals(row.get("id")));
        assertThat(consignees.list("",0,10,another).content())
            .noneMatch(row->id.equals(row.get("id")));
        assertThatThrownBy(() -> consignees.update(id,profile(another,"Hijacked",true)))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(consignees.update(id,profile(buyer,"Updated Receiving",false)).get("active"))
            .isEqualTo(false);
        assertThat(consignees.get(id).get("company_name")).isEqualTo("Updated Receiving");
        assertThatThrownBy(() -> consignees.create(new ConsigneeController.Input(
            buyer,"Invalid country",null,null,null,"ZZ","Address",true)))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="bd-user",roles="BD")
    void businessDevelopmentCannotReadShippingRecipientMaster() {
        assertThatThrownBy(() -> consignees.list("",0,10,null))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void shipmentAssignmentEnforcesOwnershipActiveFlagAndDepartureLock() {
        UUID buyer=customers.save(new Customer(new ContactInput(
            "Shipping buyer "+UUID.randomUUID(),"buyer@example.test",null,"NL"))).id;
        UUID unrelated=customers.save(new Customer(new ContactInput(
            "Unrelated buyer "+UUID.randomUUID(),"other@example.test",null,"NL"))).id;
        UUID seller=suppliers.save(new Supplier(new ContactInput(
            "Shipment supplier "+UUID.randomUUID(),"supplier@example.test",null,"CN"))).id;
        UUID matched=(UUID)consignees.create(profile(buyer,"Authorized Warehouse",true))
            .getBody().get("id");
        UUID mismatched=(UUID)consignees.create(profile(unrelated,"Other Warehouse",true))
            .getBody().get("id");
        UUID inactive=(UUID)consignees.create(profile(buyer,"Old Warehouse",false))
            .getBody().get("id");

        UUID rfq=trading.create(new TradingController.RfqInput(
            buyer,"Consignee test order","Industrial goods",new BigDecimal("10.000"),
            "PCS","USD",LocalDate.now().plusDays(14))).getBody().id();
        trading.changeStatus(rfq,new TradingController.StatusInput("SOURCING"));
        trading.saveOffer(rfq,new TradingController.OfferInput(
            seller,new BigDecimal("20.0000"),new BigDecimal("1.000"),7,"FOB"));
        trading.changeStatus(rfq,new TradingController.StatusInput("READY_FOR_QUOTE"));
        UUID quote=(UUID)commerce.createQuote(new CommerceController.QuoteInput(
            rfq,new BigDecimal("30.0000"),LocalDate.now().plusDays(14)))
            .getBody().get("id");
        commerce.quoteStatus(quote,new CommerceController.StatusInput("SUBMITTED"));
        var previous=org.springframework.security.core.context.SecurityContextHolder
            .getContext().getAuthentication();
        try {
            org.springframework.security.core.context.SecurityContextHolder.getContext()
                .setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                    "independent-manager",null,java.util.List.of(
                        new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_MANAGEMENT"))));
            commerce.quoteStatus(quote,new CommerceController.StatusInput("APPROVED"));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(previous);
        }
        UUID order=(UUID)commerce.createOrder(new CommerceController.OrderInput(quote))
            .getBody().get("id");
        commerce.orderStatus(order,new CommerceController.StatusInput("CONFIRMED"));
        UUID shipment=(UUID)logistics.create(new LogisticsController.ShipmentInput(
            order,null,"Ningbo, CN","Rotterdam, NL",null,null,
            LocalDate.now(),LocalDate.now().plusDays(30))).getBody().get("id");

        assertThatThrownBy(() -> logistics.assignConsignee(shipment,
            new LogisticsController.ConsigneeAssignment(mismatched)))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> logistics.assignConsignee(shipment,
            new LogisticsController.ConsigneeAssignment(inactive)))
            .isInstanceOf(ResponseStatusException.class);
        var linked=logistics.assignConsignee(shipment,
            new LogisticsController.ConsigneeAssignment(matched));
        assertThat(linked.get("consignee_id")).isEqualTo(matched);
        assertThat(logistics.milestones(shipment)).anyMatch(m->"CONSIGNEE_SET".equals(m.get("event")));
        int milestoneCount=logistics.milestones(shipment).size();
        logistics.assignConsignee(shipment,new LogisticsController.ConsigneeAssignment(matched));
        assertThat(logistics.milestones(shipment)).hasSize(milestoneCount);
        logistics.change(shipment,new LogisticsController.StatusInput("IN_TRANSIT","Departed"));
        assertThatThrownBy(() -> logistics.assignConsignee(shipment,
            new LogisticsController.ConsigneeAssignment(matched)))
            .isInstanceOf(ResponseStatusException.class);
    }
}
