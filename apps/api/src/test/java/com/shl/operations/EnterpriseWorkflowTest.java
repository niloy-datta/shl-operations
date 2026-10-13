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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties = {
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"
})
class EnterpriseWorkflowTest {
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
    @Autowired TradingController trading;
    @Autowired CommerceController commerce;
    @Autowired LogisticsController logistics;
    @Autowired FinanceController finance;
    @Autowired TasksController tasks;
    @Autowired StaffController staff;
    @Autowired GrowthController growth;
    @Autowired OperationalAlertsController alerts;
    @Autowired JdbcTemplate db;

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void fullCommercialLifecycleHonorsLinkagesTransitionsAndPaymentLimits() {
        String suffix = UUID.randomUUID().toString();
        Customer buyer = customers.save(new Customer(new ContactInput(
            "Enterprise Buyer "+suffix,"buyer@example.test",null,"BD")));
        Supplier seller = suppliers.save(new Supplier(new ContactInput(
            "Enterprise Vendor "+suffix,"vendor@example.test",null,"CN")));

        UUID rfqId = trading.create(new TradingController.RfqInput(
            buyer.id,"Test container shipping", "Industrial parts",
            new BigDecimal("20.000"),"PCS","USD",LocalDate.now().plusDays(10)
        )).getBody().id();
        assertThatThrownBy(() -> commerce.createQuote(new CommerceController.QuoteInput(
            rfqId,new BigDecimal("750.0000"),null)))
            .isInstanceOf(ResponseStatusException.class);

        trading.changeStatus(rfqId,new TradingController.StatusInput("SOURCING"));
        trading.saveOffer(rfqId,new TradingController.OfferInput(
            seller.id,new BigDecimal("500.0000"),new BigDecimal("5.000"),21,"FOB"));
        UUID offerId = trading.offers(rfqId).getFirst().id();
        trading.changeStatus(rfqId,new TradingController.StatusInput("READY_FOR_QUOTE"));

        UUID quoteId=(UUID)commerce.createQuote(new CommerceController.QuoteInput(
            rfqId,new BigDecimal("750.0000"),LocalDate.now().plusDays(30)
        )).getBody().get("id");
        assertThat(commerce.getQuote(quoteId).get("status")).isEqualTo("DRAFT");
        commerce.quoteStatus(quoteId,new CommerceController.StatusInput("SUBMITTED"));
        assertThatThrownBy(() -> commerce.quoteStatus(quoteId,
            new CommerceController.StatusInput("APPROVED")))
            .isInstanceOf(ResponseStatusException.class);
        var originalAuth=org.springframework.security.core.context.SecurityContextHolder
            .getContext().getAuthentication();
        try {
            org.springframework.security.core.context.SecurityContextHolder.getContext()
                .setAuthentication(new org.springframework.security.authentication
                    .UsernamePasswordAuthenticationToken(
                        "independent-approver",null,
                        java.util.List.of(new org.springframework.security.core.authority
                            .SimpleGrantedAuthority("ROLE_MANAGEMENT"))));
            commerce.quoteStatus(quoteId,new CommerceController.StatusInput("APPROVED"));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.getContext()
                .setAuthentication(originalAuth);
        }
        assertThat(commerce.getQuote(quoteId).get("approved_by")).isEqualTo("independent-approver");

        UUID salesId=(UUID)commerce.createOrder(
            new CommerceController.OrderInput(quoteId)).getBody().get("id");
        assertThat((BigDecimal)commerce.getOrder(salesId).get("total_amount"))
            .isEqualByComparingTo(new BigDecimal("15000.00"));
        commerce.orderStatus(salesId,new CommerceController.StatusInput("CONFIRMED"));

        assertThatThrownBy(() -> commerce.createPurchase(
            new CommerceController.PurchaseInput(salesId,offerId,new BigDecimal("1.000"))))
            .isInstanceOf(ResponseStatusException.class);
        UUID poId=(UUID)commerce.createPurchase(new CommerceController.PurchaseInput(
            salesId,offerId,new BigDecimal("20.000"))).getBody().get("id");
        assertThat((BigDecimal)commerce.getPurchase(poId).get("total_amount"))
            .isEqualByComparingTo(new BigDecimal("10000.00"));
        commerce.purchaseStatus(poId,new CommerceController.StatusInput("ISSUED"));

        UUID shipmentId=(UUID)logistics.create(new LogisticsController.ShipmentInput(
            salesId,poId,"Shanghai, CN","Rotterdam, NL","Carrier X","BILL-TEST",
            LocalDate.now(),LocalDate.now().plusDays(30))).getBody().get("id");
        commerce.orderStatus(salesId,new CommerceController.StatusInput("IN_PROGRESS"));
        assertThatThrownBy(() -> commerce.orderStatus(
            salesId,new CommerceController.StatusInput("COMPLETED")))
            .isInstanceOf(ResponseStatusException.class);
        logistics.change(shipmentId,new LogisticsController.StatusInput("IN_TRANSIT","Departed"));
        logistics.change(shipmentId,new LogisticsController.StatusInput("DELIVERED","Received"));
        assertThat(logistics.milestones(shipmentId)).hasSize(3);
        commerce.orderStatus(salesId,new CommerceController.StatusInput("COMPLETED"));

        UUID invoiceId=(UUID)finance.create(new FinanceController.InvoiceInput(
            salesId,null,"RECEIVABLE",new BigDecimal("1000.00"),LocalDate.now().plusDays(45)
        )).getBody().get("id");
        finance.status(invoiceId,new FinanceController.StatusInput("ISSUED"));
        finance.recordPayment(invoiceId,new FinanceController.PaymentInput(
            new BigDecimal("600.00"),"WIRE-TEST-1",LocalDate.now()));
        assertThatThrownBy(() -> finance.recordPayment(invoiceId,new FinanceController.PaymentInput(
            new BigDecimal("500.00"),"WIRE-TEST-2",LocalDate.now())))
            .isInstanceOf(ResponseStatusException.class);
        finance.recordPayment(invoiceId,new FinanceController.PaymentInput(
            new BigDecimal("400.00"),"WIRE-TEST-3",LocalDate.now()));
        assertThat(finance.get(invoiceId).get("status")).isEqualTo("PAID");
        assertThat(finance.payments(invoiceId)).hasSize(2);
        assertThatThrownBy(() -> finance.status(invoiceId,new FinanceController.StatusInput("VOID")))
            .isInstanceOf(ResponseStatusException.class);

        UUID payable=(UUID)finance.create(new FinanceController.InvoiceInput(
            salesId,poId,"PAYABLE",new BigDecimal("1500.00"),null
        )).getBody().get("id");
        finance.status(payable,new FinanceController.StatusInput("ISSUED"));
        assertThat(finance.summary()).containsKeys("receivables","payables","unpaidInvoices");

        UUID adminId=db.queryForObject(
            "SELECT id FROM staff_users WHERE username='test-admin'",UUID.class);
        UUID taskId=(UUID)tasks.create(new TasksController.TaskInput(
            "Verify delivery packet","Check shipment documents",adminId,null,
            salesId,null,LocalDate.now().plusDays(1),"HIGH")).getBody().get("id");
        assertThat(tasks.list(0,20).content()).anyMatch(r->taskId.equals(r.get("id")));
        tasks.status(taskId,new TasksController.StatusInput("IN_PROGRESS"));
        tasks.status(taskId,new TasksController.StatusInput("DONE"));

        Long count=db.queryForObject("SELECT count(*) FROM audit_events",Long.class);
        assertThat(count).isGreaterThanOrEqualTo(15);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void expiredQuotesCannotBeApprovedOrTurnedIntoOrders() {
        String suffix=UUID.randomUUID().toString();
        Customer buyer=customers.save(new Customer(new ContactInput(
            "Quote expiry buyer "+suffix, "expiry@example.test", null, "BD")));
        Supplier seller=suppliers.save(new Supplier(new ContactInput(
            "Quote expiry supplier "+suffix, "offers@example.test", null, "CN")));
        UUID rfqId=trading.create(new TradingController.RfqInput(
            buyer.id, "Expiry test RFQ", "Demo specifications",
            new BigDecimal("5"), "PCS", "USD", null)).getBody().id();
        trading.changeStatus(rfqId,new TradingController.StatusInput("SOURCING"));
        trading.saveOffer(rfqId,new TradingController.OfferInput(
            seller.id,new BigDecimal("7.00"),new BigDecimal("1"),10,null));
        trading.changeStatus(rfqId,new TradingController.StatusInput("READY_FOR_QUOTE"));

        UUID expiredId=(UUID)commerce.createQuote(new CommerceController.QuoteInput(
            rfqId,new BigDecimal("12.00"),LocalDate.now().minusDays(1)))
            .getBody().get("id");
        commerce.quoteStatus(expiredId,new CommerceController.StatusInput("SUBMITTED"));

        UUID validId=(UUID)commerce.createQuote(new CommerceController.QuoteInput(
            rfqId,new BigDecimal("12.00"),LocalDate.now().plusDays(30)))
            .getBody().get("id");
        commerce.quoteStatus(validId,new CommerceController.StatusInput("SUBMITTED"));

        var context=org.springframework.security.core.context.SecurityContextHolder.getContext();
        var original=context.getAuthentication();
        try {
            context.setAuthentication(new org.springframework.security.authentication
                .UsernamePasswordAuthenticationToken(
                    "independent-approver",null,
                    java.util.List.of(new org.springframework.security.core.authority
                        .SimpleGrantedAuthority("ROLE_MANAGEMENT"))));
            assertThatThrownBy(()->commerce.quoteStatus(expiredId,
                new CommerceController.StatusInput("APPROVED")))
                .isInstanceOf(ResponseStatusException.class);
            commerce.quoteStatus(validId,new CommerceController.StatusInput("APPROVED"));
        } finally {
            context.setAuthentication(original);
        }

        db.update("UPDATE customer_quotes SET valid_until=? WHERE id=?",
            LocalDate.now().minusDays(1),validId);
        assertThatThrownBy(()->commerce.createOrder(
            new CommerceController.OrderInput(validId)))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void administratorsCanProvisionStaffAndRoleChangesAreValidated() {
        String username="operator-"+UUID.randomUUID().toString().substring(0,8);
        var member=staff.create(new StaffController.NewStaff(
            username,"strong-temporary-password-234","LOGISTICS"));
        assertThat(member).containsEntry("role","LOGISTICS");
        assertThat(member).doesNotContainKey("password_hash");
        UUID id=(UUID)member.get("id");
        staff.changeAccess(id,new StaffController.ChangeAccess("SOURCING",true));
        assertThat(staff.options()).anyMatch(o->username.equals(o.get("username")));
        assertThatThrownBy(() -> staff.changeAccess(id,
            new StaffController.ChangeAccess("INVALID",true)))
            .isInstanceOf(ResponseStatusException.class);
        UUID self=db.queryForObject("SELECT id FROM staff_users WHERE username='test-admin'",UUID.class);
        assertThatThrownBy(() -> staff.changeAccess(self,
            new StaffController.ChangeAccess("FINANCE",false)))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void leadPipelineCreatesLinkedProjectWithAuditableNotes() {
        String suffix=UUID.randomUUID().toString();
        var buyer=customers.save(new Customer(new ContactInput(
            "CRM buyer "+suffix,"crm@example.test",null,"Germany")));
        UUID owner=db.queryForObject("SELECT id FROM staff_users WHERE username='test-admin'",UUID.class);
        var lead=growth.addLead(new GrowthController.LeadInput(
            buyer.id,"CRM company "+suffix,"Decision Maker","decision@example.test","EMAIL",
            "Industrial components", "Request for pricing",owner,LocalDate.now().plusDays(2)
        )).getBody();
        UUID leadId=(UUID)lead.get("id");
        assertThat(growth.leads("CRM company",0,10).content())
            .anyMatch(x->leadId.equals(x.get("id")));
        assertThatThrownBy(()->growth.leadStatus(leadId,
            new GrowthController.ChangeStatus("WON")))
            .isInstanceOf(ResponseStatusException.class);
        growth.leadStatus(leadId,new GrowthController.ChangeStatus("CONTACTED"));
        growth.leadStatus(leadId,new GrowthController.ChangeStatus("QUALIFIED"));
        growth.leadStatus(leadId,new GrowthController.ChangeStatus("WON"));
        UUID id=(UUID)growth.addProject(new GrowthController.ProjectInput(
            buyer.id,leadId,null,"Customer shipment job",null,owner,
            LocalDate.now().plusDays(10)
        )).getBody().get("id");
        assertThat(growth.projects("Customer shipment",0,20).content())
            .anyMatch(x->id.equals(x.get("id")));
        growth.note(id,new GrowthController.NoteInput("Supplier call completed"));
        assertThat(growth.notes(id)).anyMatch(x->
            "Supplier call completed".equals(x.get("note")));
        growth.projectStatus(id,new GrowthController.ChangeStatus("ACTIVE"));
        growth.projectStatus(id,new GrowthController.ChangeStatus("COMPLETED"));
        assertThat(growth.project(id).get("status")).isEqualTo("COMPLETED");
        assertThatThrownBy(()->growth.projectStatus(id,
            new GrowthController.ChangeStatus("ACTIVE")))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->growth.addProject(new GrowthController.ProjectInput(
            buyer.id,leadId,null,"Duplicate lead project",null,owner,null
        ))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void roleScopedAlertFeedUsesRealDeadlines() {
        String suffix=UUID.randomUUID().toString();
        Customer buyer=customers.save(new Customer(new ContactInput(
            "Alert buyer "+suffix,"alert@example.test",null,"CN")));
        UUID owner=db.queryForObject(
            "SELECT id FROM staff_users WHERE username='test-admin'",UUID.class);
        String subject="Follow-up "+suffix;
        UUID leadId=(UUID)growth.addLead(new GrowthController.LeadInput(
            buyer.id,"Buyer "+suffix,"Test lead","lead@example.test","MANUAL",
            subject,null,owner,LocalDate.now(java.time.ZoneOffset.UTC)
        )).getBody().get("id");
        var feed=alerts.feed();
        assertThat(feed.items()).anyMatch(item->"LEAD".equals(item.source())
            && subject.equals(item.title()));
        assertThat(feed.dueToday()).isPositive();
        assertThat(feed.timezone()).isEqualTo("UTC");
        assertThat(feed.items()).noneMatch(item->"COMMISSION".equals(item.source()));
        growth.leadStatus(leadId,new GrowthController.ChangeStatus("LOST"));
        assertThat(alerts.feed().items()).noneMatch(item->subject.equals(item.title()));
    }

    @Test
    @WithMockUser(username="limited-user",roles="BD")
    void bdAlertFeedDoesNotExposeInvoicesOrUnownedProjects() {
        assertThat(alerts.feed().items()).noneMatch(item->
            "INVOICE".equals(item.source())||"SHIPMENT".equals(item.source()));
    }

    @Test
    @WithMockUser(username="limited-user",roles="BD")
    void businessDevelopmentCannotReadFinanceOrManageStaff() {
        assertThatThrownBy(() -> finance.list("",0,20))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> staff.list(0,20))
            .isInstanceOf(AccessDeniedException.class);
    }
}
