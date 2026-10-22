package com.shl.operations;

import com.shl.operations.contacts.*;
import com.shl.operations.enterprise.*;
import com.shl.operations.trading.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
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
class CustomerLineQuotesWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("DB_URL",postgres::getJdbcUrl);
        r.add("DB_USERNAME",postgres::getUsername);
        r.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired CustomerRepository customers;
    @Autowired SupplierRepository suppliers;
    @Autowired TradingController rfqs;
    @Autowired RfqItemsController items;
    @Autowired RfqLineOffersController supplierPrices;
    @Autowired CustomerLineQuotesController quotes;
    @Autowired CommerceController oldCommerce;
    @Autowired LineOrdersController lineOrders;
    @Autowired LineShipmentController shipmentFlow;
    @Autowired LineShippingDocumentsController documents;
    @Autowired LineBillingReviewController billingFlow;
    @Autowired JdbcTemplate db;

    private UUID inquiry() {
        var c=customers.save(new Customer(new ContactInput(
            "Line quote buyer "+UUID.randomUUID(),"buyer@example.test",null,"BD")));
        return rfqs.create(new TradingController.RfqInput(c.id,
            "Structured buying inquiry","Two products",new BigDecimal("10"),"PCS","USD",null))
            .getBody().id();
    }
    private UUID supplier() {
        return suppliers.save(new Supplier(new ContactInput(
            "Line quote supplier "+UUID.randomUUID(),"seller@example.test",null,"CN"))).id;
    }
    private UUID item(UUID rfq,String name,String qty,String unit) {
        return items.add(rfq,new RfqItemsController.ItemInput(name,"ASTM","7208",
            new BigDecimal(qty),unit,null,"China","Venezuela")).id();
    }
    private UUID source(UUID rfq,UUID item,UUID supplier,String price) {
        return supplierPrices.add(rfq,new RfqLineOffersController.NewRevision(
            item,supplier,new BigDecimal(price),new BigDecimal("1"),
            21,"FOB","Shanghai","Supplier evidence pending")).id();
    }
    private static void switchUser(String name,String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            name,null,List.of(new SimpleGrantedAuthority("ROLE_"+role))));
    }

    @Test @WithMockUser(username="quote-author",roles="BD")
    void approvedQuoteHasImmutablePricedLinesAndIndependentApproval() {
        UUID rfq=inquiry();
        UUID first=item(rfq,"Industrial plate","10","PCS");
        UUID second=item(rfq,"Steel coil","5","MT");
        UUID supplier=supplier();
        rfqs.changeStatus(rfq,new TradingController.StatusInput("SOURCING"));
        UUID a=source(rfq,first,supplier,"100");
        UUID b=source(rfq,second,supplier,"200");
        var draft=quotes.create(new CustomerLineQuotesController.Create(rfq,null,List.of(
            new CustomerLineQuotesController.SelectedLine(first,a,new BigDecimal("125")),
            new CustomerLineQuotesController.SelectedLine(second,b,new BigDecimal("240"))
        )));
        UUID quoteId=(UUID)draft.quote().get("id");
        assertThat((BigDecimal)draft.quote().get("total_cost")).isEqualByComparingTo("2000");
        assertThat((BigDecimal)draft.quote().get("total_sell")).isEqualByComparingTo("2450");
        assertThat((BigDecimal)draft.quote().get("gross_contribution")).isEqualByComparingTo("450");
        assertThat(draft.lines()).hasSize(2);
        assertThat(quotes.submit(quoteId).quote().get("status")).isEqualTo("SUBMITTED");
        assertThatThrownBy(()->quotes.review(quoteId,
            new CustomerLineQuotesController.Review("APPROVED","I reviewed the terms")))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->supplierPrices.add(rfq,
            new RfqLineOffersController.NewRevision(first,supplier,new BigDecimal("90"),
                new BigDecimal("1"),10,"FOB",null,null)))
            .isInstanceOf(ResponseStatusException.class);
        var original=SecurityContextHolder.getContext().getAuthentication();
        try {
            switchUser("independent-manager","MANAGEMENT");
            assertThat(quotes.review(quoteId,
                new CustomerLineQuotesController.Review("APPROVED","Costs reviewed"))
                .quote().get("status")).isEqualTo("APPROVED");
        } finally {
            SecurityContextHolder.getContext().setAuthentication(original);
        }
        assertThat(quotes.detail(quoteId).lines()).hasSize(2);
        assertThatThrownBy(()->db.update(
            "UPDATE customer_line_quote_items SET sell_unit_price=1 WHERE quote_id=?",quoteId))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(()->quotes.create(new CustomerLineQuotesController.Create(
            rfq,null,List.of(new CustomerLineQuotesController.SelectedLine(first,a,
                new BigDecimal("130")),new CustomerLineQuotesController.SelectedLine(second,b,
                new BigDecimal("250"))))))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test @WithMockUser(username="draft-owner",roles="BD")
    void staleSupplierCostsRequireNewQuoteVersion() {
        UUID rfq=inquiry(),first=item(rfq,"Copper parts","10","PCS"),supplier=supplier();
        rfqs.changeStatus(rfq,new TradingController.StatusInput("SOURCING"));
        UUID old=source(rfq,first,supplier,"15");
        var original=quotes.create(new CustomerLineQuotesController.Create(rfq,null,
            List.of(new CustomerLineQuotesController.SelectedLine(first,old,
                new BigDecimal("20")))));
        UUID updated=source(rfq,first,supplier,"18");
        assertThatThrownBy(()->quotes.submit((UUID)original.quote().get("id")))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("newer revisions");
        var second=quotes.create(new CustomerLineQuotesController.Create(rfq,null,
            List.of(new CustomerLineQuotesController.SelectedLine(first,updated,
                new BigDecimal("22")))));
        assertThat(second.quote().get("version")).isEqualTo(2);
        assertThat(quotes.submit((UUID)second.quote().get("id")).quote().get("status"))
            .isEqualTo("SUBMITTED");
    }

    @Test @WithMockUser(username="creator",roles="BD")
    void rejectsCrossRfqRevisionsOmittedLinesAndNegativeMarkup() {
        UUID rfq1=inquiry(),rfq2=inquiry();
        UUID item1=item(rfq1,"Item1","10","PCS");
        UUID item2=item(rfq1,"Item2","4","MT");
        UUID foreign=item(rfq2,"Foreign","10","PCS");
        UUID seller=supplier();
        rfqs.changeStatus(rfq1,new TradingController.StatusInput("SOURCING"));
        rfqs.changeStatus(rfq2,new TradingController.StatusInput("SOURCING"));
        UUID cost1=source(rfq1,item1,seller,"10");
        UUID cost2=source(rfq1,item2,seller,"20");
        UUID foreignSource=source(rfq2,foreign,seller,"8");
        assertThatThrownBy(()->quotes.create(new CustomerLineQuotesController.Create(
            rfq1,null,List.of(new CustomerLineQuotesController.SelectedLine(
                item1,cost1,new BigDecimal("12"))))))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->quotes.create(new CustomerLineQuotesController.Create(
            rfq1,null,List.of(
                new CustomerLineQuotesController.SelectedLine(item1,cost1,new BigDecimal("12")),
                new CustomerLineQuotesController.SelectedLine(item2,foreignSource,
                    new BigDecimal("40"))))))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->quotes.create(new CustomerLineQuotesController.Create(
            rfq1,null,List.of(
                new CustomerLineQuotesController.SelectedLine(item1,cost1,new BigDecimal("9")),
                new CustomerLineQuotesController.SelectedLine(item2,cost2,new BigDecimal("40"))))))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(quotes.list(rfq1)).isEmpty();
    }

    @Test @WithMockUser(username="finance-auditor",roles="FINANCE")
    void financeCannotReadConfidentialSourcingPriceOrCreateQuote() {
        assertThatThrownBy(()->quotes.list(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->quotes.create(new CustomerLineQuotesController.Create(
            UUID.randomUUID(),null,List.of())))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test @WithMockUser(username="order-author",roles="BD")
    void approvedMultiSupplierQuoteBecomesAuditedSalesOrderAndMatchedPurchaseOrders() {
        UUID rfq=inquiry();
        UUID plate=item(rfq,"ASTM steel plate","10","PCS");
        UUID coil=item(rfq,"Industrial coil","5","MT");
        UUID supplierOne=supplier(),supplierTwo=supplier();
        rfqs.changeStatus(rfq,new TradingController.StatusInput("SOURCING"));
        UUID priceOne=source(rfq,plate,supplierOne,"100");
        UUID priceTwo=source(rfq,coil,supplierTwo,"200");
        var approved=quotes.create(new CustomerLineQuotesController.Create(
            rfq,java.time.LocalDate.now().plusDays(25),List.of(
                new CustomerLineQuotesController.SelectedLine(plate,priceOne,new BigDecimal("125")),
                new CustomerLineQuotesController.SelectedLine(coil,priceTwo,new BigDecimal("240"))
            )));
        UUID quote=(UUID)approved.quote().get("id");
        assertThatThrownBy(()->lineOrders.create(new LineOrdersController.FromQuote(quote)))
            .isInstanceOf(ResponseStatusException.class);
        quotes.submit(quote);
        var actor=SecurityContextHolder.getContext().getAuthentication();
        try {
            switchUser("quote-manager","MANAGEMENT");
            quotes.review(quote,new CustomerLineQuotesController.Review("APPROVED","Verified prices"));
        } finally {SecurityContextHolder.getContext().setAuthentication(actor);}

        var sale=lineOrders.create(new LineOrdersController.FromQuote(quote)).getBody();
        assertThat(sale).isNotNull();
        UUID orderId=(UUID)sale.order().get("id");
        assertThat((BigDecimal)sale.order().get("total_amount"))
            .isEqualByComparingTo("2450.00");
        assertThat(sale.lines()).hasSize(2);
        assertThatThrownBy(()->lineOrders.create(new LineOrdersController.FromQuote(quote)))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("already has");
        assertThatThrownBy(()->lineOrders.createPurchase(orderId,
            new LineOrdersController.SupplierSelection(supplierOne)))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->lineOrders.status(orderId,
            new LineOrdersController.Transition("CONFIRMED")))
            .isInstanceOf(AccessDeniedException.class);
        try {
            switchUser("independent-manager","MANAGEMENT");
            assertThat(lineOrders.status(orderId,
                new LineOrdersController.Transition("CONFIRMED")).order().get("status"))
                .isEqualTo("CONFIRMED");
            assertThatThrownBy(()->lineOrders.createPurchase(orderId,
                new LineOrdersController.SupplierSelection(UUID.randomUUID())))
                .isInstanceOf(ResponseStatusException.class);
            var po1=lineOrders.createPurchase(orderId,
                new LineOrdersController.SupplierSelection(supplierOne)).getBody();
            var po2=lineOrders.createPurchase(orderId,
                new LineOrdersController.SupplierSelection(supplierTwo)).getBody();
            assertThat(po1).isNotNull();
            assertThat(po2).isNotNull();
            assertThat((BigDecimal)po1.purchase().get("total_amount"))
                .isEqualByComparingTo("1000.00");
            assertThat((BigDecimal)po2.purchase().get("total_amount"))
                .isEqualByComparingTo("1000.00");
            assertThat(po1.lines()).hasSize(1);
            assertThat(po2.lines()).hasSize(1);
            UUID poId=(UUID)po1.purchase().get("id");
            assertThatThrownBy(()->lineOrders.createPurchase(orderId,
                new LineOrdersController.SupplierSelection(supplierOne)))
                .isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(()->lineOrders.purchaseStatus(poId,
                new LineOrdersController.Transition("ISSUED")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("creator cannot");
            switchUser("second-manager","ADMIN");
            assertThat(lineOrders.purchaseStatus(poId,
                new LineOrdersController.Transition("ISSUED")).purchase().get("status"))
                .isEqualTo("ISSUED");
            assertThatThrownBy(()->lineOrders.status(orderId,
                new LineOrdersController.Transition("CANCELLED")))
                .isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(()->db.update("""
                UPDATE line_sales_order_items SET sell_unit_price=1 WHERE sales_order_id=?
                """,orderId)).isInstanceOf(org.springframework.dao.DataAccessException.class);
            assertThatThrownBy(()->db.update("""
                UPDATE line_purchase_order_items SET unit_cost=1 WHERE purchase_order_id=?
                """,poId)).isInstanceOf(org.springframework.dao.DataAccessException.class);
            assertThat(lineOrders.detail(orderId).purchaseOrders()).hasSize(2);
            Long legacy=db.queryForObject("SELECT count(*) FROM sales_orders WHERE rfq_id=?",
                Long.class,rfq);
            assertThat(legacy).isZero();
        } finally {SecurityContextHolder.getContext().setAuthentication(actor);}
    }

    @Test @WithMockUser(username="data-reviewer",roles="FINANCE")
    void financeCannotReadSupplierLineOrderSourcesOrCreateLinePurchase() {
        assertThatThrownBy(()->lineOrders.list(null,0,20))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->lineOrders.create(
            new LineOrdersController.FromQuote(UUID.randomUUID())))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->lineOrders.purchase(
            UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);
    }


    @Test @WithMockUser(username="line-booking-author",roles="BD")
    void issuedSupplierPoCreatesAuditedAndImmutableShipmentMilestones() {
        UUID rfq=inquiry(),product=item(rfq,"Trade cargo","6","MT"),supplier=supplier();
        rfqs.changeStatus(rfq,new TradingController.StatusInput("SOURCING"));
        UUID revision=source(rfq,product,supplier,"120");
        var draft=quotes.create(new CustomerLineQuotesController.Create(
            rfq,null,List.of(new CustomerLineQuotesController.SelectedLine(
                product,revision,new BigDecimal("145")))));
        UUID quote=(UUID)draft.quote().get("id");
        quotes.submit(quote);
        var initial=SecurityContextHolder.getContext().getAuthentication();
        try {
            switchUser("independent-quote-reviewer","MANAGEMENT");
            quotes.review(quote,new CustomerLineQuotesController.Review(
                "APPROVED","Approved test quotation"));
            switchUser("line-booking-author","BD");
            UUID orderId=(UUID)lineOrders.create(
                new LineOrdersController.FromQuote(quote)).getBody().order().get("id");
            switchUser("order-manager","MANAGEMENT");
            lineOrders.status(orderId,new LineOrdersController.Transition("CONFIRMED"));
            UUID poId=(UUID)lineOrders.createPurchase(orderId,
                new LineOrdersController.SupplierSelection(supplier))
                .getBody().purchase().get("id");
            assertThatThrownBy(()->shipmentFlow.create(new LineShipmentController.Booking(
                poId,"China","Netherlands",null,null,null,null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only issued");
            switchUser("po-approver","ADMIN");
            lineOrders.purchaseStatus(poId,new LineOrdersController.Transition("ISSUED"));
            switchUser("dispatch-operator","LOGISTICS");
            var booking=new LineShipmentController.Booking(poId,
                "Shanghai, CN","Rotterdam, NL","Carrier One","BL-TEST",
                java.time.LocalDate.now(),java.time.LocalDate.now().plusDays(20));
            var created=shipmentFlow.create(booking).getBody();
            UUID shipmentId=(UUID)created.shipment().get("id");
            assertThat(documents.list(shipmentId)).hasSize(5)
                .allMatch(x->"MISSING".equals(x.status()));
            assertThatThrownBy(()->documents.change(shipmentId,"TRANSPORT_DOCUMENT",
                new LineShippingDocumentsController.Change("REPORTED_RECEIVED",null,null)))
                .isInstanceOf(ResponseStatusException.class);
            documents.change(shipmentId,"TRANSPORT_DOCUMENT",
                new LineShippingDocumentsController.Change("REQUESTED",null,"Requested from carrier"));
            assertThat(documents.change(shipmentId,"TRANSPORT_DOCUMENT",
                new LineShippingDocumentsController.Change("REPORTED_RECEIVED","BL-TEST-REF",
                    "Self-reported carrier reference")))
                .anyMatch(x->"TRANSPORT_DOCUMENT".equals(x.kind())
                    &&"REPORTED_RECEIVED".equals(x.status()));
            assertThatThrownBy(()->documents.change(shipmentId,"TRANSPORT_DOCUMENT",
                new LineShippingDocumentsController.Change("REPORTED_RECEIVED","BL-TEST-REF",
                    "Self-reported carrier reference")))
                .isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(()->documents.change(shipmentId,"TRANSPORT_DOCUMENT",
                new LineShippingDocumentsController.Change("MISSING",null,null)))
                .isInstanceOf(ResponseStatusException.class);
            documents.change(shipmentId,"TRANSPORT_DOCUMENT",
                new LineShippingDocumentsController.Change("MISSING",null,"Incorrect reported reference"));
            assertThat(db.queryForObject("""
                SELECT count(*) FROM line_shipment_document_events
                WHERE shipment_id=? AND kind='TRANSPORT_DOCUMENT'
                """,Integer.class,shipmentId)).isEqualTo(3);
            assertThatThrownBy(()->db.update("""
                DELETE FROM line_shipment_document_events WHERE shipment_id=?
                """,shipmentId)).isInstanceOf(org.springframework.dao.DataAccessException.class);
            switchUser("line-sourcing-reader","SOURCING");
            assertThat(documents.list(shipmentId)).hasSize(5);
            assertThatThrownBy(()->documents.change(shipmentId,"PACKING_LIST",
                new LineShippingDocumentsController.Change("REQUESTED",null,null)))
                .isInstanceOf(AccessDeniedException.class);
            switchUser("dispatch-operator","LOGISTICS");
            assertThat(created.lines()).hasSize(1);
            assertThat(created.milestones()).hasSize(1);
            assertThat(created.shipment().get("status")).isEqualTo("BOOKED");
            assertThat(shipmentFlow.list(orderId,0,20).content())
                .anyMatch(x->shipmentId.equals(x.get("id")));
            assertThatThrownBy(()->shipmentFlow.create(booking))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already has");
            assertThatThrownBy(()->shipmentFlow.create(new LineShipmentController.Booking(
                poId,"Same port","Same port",null,null,null,null)))
                .isInstanceOf(ResponseStatusException.class);
            assertThat(shipmentFlow.change(shipmentId,new LineShipmentController.Status(
                "IN_TRANSIT","Actual departure recorded")).shipment().get("atd")).isNotNull();
            assertThatThrownBy(()->shipmentFlow.change(shipmentId,
                new LineShipmentController.Status("IN_TRANSIT","Repeat")))
                .isInstanceOf(ResponseStatusException.class);
            assertThat(shipmentFlow.change(shipmentId,new LineShipmentController.Status(
                "DELIVERED","Delivery confirmed by operator")).shipment().get("ata")).isNotNull();
            assertThat(shipmentFlow.detail(shipmentId).milestones()).hasSize(3);
            assertThatThrownBy(()->db.update("""
                UPDATE line_shipment_items SET quantity=1 WHERE shipment_id=?
                """,shipmentId)).isInstanceOf(org.springframework.dao.DataAccessException.class);
            assertThatThrownBy(()->db.update("""
                DELETE FROM line_shipment_events WHERE shipment_id=?
                """,shipmentId)).isInstanceOf(org.springframework.dao.DataAccessException.class);
            assertThatThrownBy(()->shipmentFlow.change(shipmentId,
                new LineShipmentController.Status("CANCELLED","Too late")))
                .isInstanceOf(ResponseStatusException.class);
            Long count=db.queryForObject("SELECT count(*) FROM shipments WHERE sales_order_id=?",
                Long.class,orderId);
            assertThat(count).isZero();
            switchUser("unauthorized-bd","BD");
            assertThatThrownBy(()->documents.list(shipmentId))
                .isInstanceOf(AccessDeniedException.class);
            assertThatThrownBy(()->shipmentFlow.list(orderId,0,20))
                .isInstanceOf(AccessDeniedException.class);
        } finally {SecurityContextHolder.getContext().setAuthentication(initial);}
    }


    @Test @WithMockUser(username="billing-quote-author",roles="BD")
    void deliveredLineOrderGeneratesReviewedButUnpostedBillingCandidate() {
        UUID rfq=inquiry(),product=item(rfq,"Cargo industrial parts","8","PCS"),supplier=supplier();
        rfqs.changeStatus(rfq,new TradingController.StatusInput("SOURCING"));
        UUID supplierQuote=source(rfq,product,supplier,"50");
        UUID quote=(UUID)quotes.create(new CustomerLineQuotesController.Create(
            rfq,null,List.of(new CustomerLineQuotesController.SelectedLine(
                product,supplierQuote,new BigDecimal("75"))))).quote().get("id");
        quotes.submit(quote);
        var initial=SecurityContextHolder.getContext().getAuthentication();
        try {
            switchUser("billing-quote-reviewer","MANAGEMENT");
            quotes.review(quote,new CustomerLineQuotesController.Review("APPROVED","Quote checked"));
            switchUser("billing-quote-author","BD");
            UUID orderId=(UUID)lineOrders.create(new LineOrdersController.FromQuote(quote))
                .getBody().order().get("id");
            switchUser("billing-order-manager","MANAGEMENT");
            lineOrders.status(orderId,new LineOrdersController.Transition("CONFIRMED"));
            assertThatThrownBy(()->billingFlow.create(new LineBillingReviewController.Create(
                orderId,java.time.LocalDate.now().plusDays(30))))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("delivered shipment");

            UUID poId=(UUID)lineOrders.createPurchase(orderId,
                new LineOrdersController.SupplierSelection(supplier)).getBody()
                .purchase().get("id");
            switchUser("second-procurement-manager","ADMIN");
            lineOrders.purchaseStatus(poId,new LineOrdersController.Transition("ISSUED"));
            switchUser("shipment-operator","LOGISTICS");
            UUID shipmentId=(UUID)shipmentFlow.create(new LineShipmentController.Booking(
                poId,"Shanghai","Rotterdam",null,null,null,null)).getBody()
                .shipment().get("id");
            shipmentFlow.change(shipmentId,
                new LineShipmentController.Status("IN_TRANSIT","Actual cargo departure"));
            shipmentFlow.change(shipmentId,
                new LineShipmentController.Status("DELIVERED","Delivery observed"));

            switchUser("finance-preparer","FINANCE");
            assertThat(billingFlow.eligibleOrders())
                .anyMatch(x->orderId.equals(x.get("id")));
            var billing=billingFlow.create(new LineBillingReviewController.Create(
                orderId,java.time.LocalDate.now().plusDays(30))).getBody();
            assertThat(billing).isNotNull();
            UUID billingId=(UUID)billing.billing().get("id");
            assertThat((BigDecimal)billing.billing().get("amount"))
                .isEqualByComparingTo("600.00");
            assertThat(billing.lines()).hasSize(1);
            assertThat(billingFlow.eligibleOrders())
                .noneMatch(x->orderId.equals(x.get("id")));
            assertThatThrownBy(()->billingFlow.create(new LineBillingReviewController.Create(
                orderId,null))).isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(()->billingFlow.review(billingId,
                new LineBillingReviewController.Review("REVIEWED","Self review")))
                .isInstanceOf(AccessDeniedException.class);
            assertThatThrownBy(()->db.update("""
                UPDATE line_billing_candidate_items SET line_total=1 WHERE billing_id=?
                """,billingId)).isInstanceOf(org.springframework.dao.DataAccessException.class);
            switchUser("finance-review-manager","MANAGEMENT");
            assertThat(billingFlow.review(billingId,
                new LineBillingReviewController.Review("REVIEWED",
                    "Ready for future legal tax review, not posted")).billing().get("status"))
                .isEqualTo("REVIEWED");
            assertThatThrownBy(()->billingFlow.review(billingId,
                new LineBillingReviewController.Review("VOID","Repeat review")))
                .isInstanceOf(ResponseStatusException.class);
            Long legacy=db.queryForObject("SELECT count(*) FROM invoices WHERE sales_order_id=?",
                Long.class,orderId);
            assertThat(legacy).isZero();
            switchUser("unrelated-bd","BD");
            assertThatThrownBy(()->billingFlow.list(0,20))
                .isInstanceOf(AccessDeniedException.class);
        } finally {SecurityContextHolder.getContext().setAuthentication(initial);}
    }

}
