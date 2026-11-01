package com.shl.operations.security;

import com.fasterxml.jackson.databind.*;
import java.net.*;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="debug=false")
class FullStackIntegrationIT {
    static final TestIdentity identity=new TestIdentity();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url",()->required("NORTHSTAR_TEST_DB_URL"));
        properties.add("spring.datasource.username",()->required("NORTHSTAR_TEST_DB_USERNAME"));
        properties.add("spring.datasource.password",()->required("NORTHSTAR_TEST_DB_PASSWORD"));
        properties.add("northstar.auth.issuer",()->identity.issuer);
        properties.add("northstar.auth.jwks-uri",()->identity.issuer+"/.well-known/jwks.json");
        properties.add("northstar.auth.mode",()->"jwks");
    }
    static String required(String name) {
        String value=System.getenv(name);
        if(value==null||value.isBlank())throw new IllegalStateException("Set "+name+" to an isolated disposable PostgreSQL database");
        return value;
    }
    @LocalServerPort int port;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired Flyway flyway;
    final HttpClient http=HttpClient.newHttpClient();
    UUID subject,staff,session;
    String token;
    record Reply(int status,JsonNode body) {}
    @BeforeEach void staff() {
        subject=UUID.randomUUID(); staff=UUID.randomUUID();session=UUID.randomUUID();
        db.update("INSERT INTO staff_users(id,username,role,supabase_user_id,mfa_required) VALUES(?,?,'ADMIN',?,true)",staff,"test-"+staff,subject);
        token=identity.sign(identity.claims(subject,session).build());
    }
    @AfterAll static void stop() { identity.close(); }
    Reply request(String method,String path,String bearer,Object body) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path));
        if(bearer!=null)builder.header("Authorization","Bearer "+bearer);
        if(body!=null)builder.header("Content-Type","application/json");
        builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        var response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());
        JsonNode result=response.body().isBlank()?json.nullNode():json.readTree(response.body());
        return new Reply(response.statusCode(),result);
    }
    Reply get(String path) throws Exception { return request("GET",path,token,null); }
    @Test void requiresCryptographicallyValidTokens() throws Exception {
        assertThat(request("GET","/api/dashboard",null,null).status).isEqualTo(401);
        assertThat(request("GET","/api/dashboard","broken",null).status).isEqualTo(401);
        for(var claims:List.of(identity.claims(subject,session).issuer("https://wrong.example").build(),
            identity.claims(subject,session).audience("anon").build(),
            identity.claims(subject,session).expirationTime(Date.from(Instant.now().minusSeconds(120))).build()))
            assertThat(request("GET","/api/dashboard",identity.sign(claims),null).status).isEqualTo(401);
    }
    @Test void databaseRoleAndEnabledFlagOverrideEditableMetadata() throws Exception {
        db.update("UPDATE staff_users SET role='BD' WHERE id=?",staff);
        token=identity.sign(identity.claims(subject,session).claim("user_metadata",Map.of("role","ADMIN")).build());
        assertThat(get("/api/staff").status).isEqualTo(403);
        assertThat(get("/api/me").body.path("role").asText()).isEqualTo("BD");
        db.update("UPDATE staff_users SET enabled=false WHERE id=?",staff);
        assertThat(get("/api/dashboard").status).isEqualTo(403);
        String unbound=identity.sign(identity.claims(UUID.randomUUID(),UUID.randomUUID()).build());
        assertThat(request("GET","/api/dashboard",unbound,null).status).isEqualTo(403);
    }
    @Test void mfaPolicyAllowsSecuritySetupButProtectsBusinessAndSensitiveRecords() throws Exception {
        token=identity.sign(identity.claims(subject,session).claim("aal","aal1").build());
        assertThat(get("/api/me").status).isEqualTo(200);
        Reply blocked=get("/api/dashboard");
        assertThat(blocked.status).isEqualTo(403);
        assertThat(blocked.body.path("code").asText()).isEqualTo("MFA_REQUIRED");
        db.update("UPDATE staff_users SET mfa_required=false WHERE id=?",staff);
        assertThat(get("/api/dashboard").status).isEqualTo(200);
        assertThat(get("/api/staff").status).isEqualTo(403);
    }
    @Test void contactsAndRfqPersistSearchPaginateValidateAndAudit() throws Exception {
        String name="Customer "+UUID.randomUUID();
        Reply created=request("POST","/api/customers",token,Map.of("name",name,"email","contact@example.test","country","Bangladesh"));
        assertThat(created.status).isEqualTo(201);
        assertThat(request("POST","/api/customers",token,Map.of("name",name,"email","contact@example.test","country","Bangladesh")).status).isEqualTo(409);
        String id=created.body.path("id").asText();
        assertThat(get("/api/customers?q="+URLEncoder.encode(name,java.nio.charset.StandardCharsets.UTF_8)+"&size=1").body.path("totalElements").asInt()).isEqualTo(1);
        assertThat(get("/api/customers?q=no-such-"+UUID.randomUUID()).body.path("content").isEmpty()).isTrue();
        assertThat(request("PUT","/api/customers/"+id,token,Map.of("name",name+" edited")).status).isEqualTo(200);
        assertThat(request("POST","/api/customers",token,Map.of("name"," ","email","bad")).status).isEqualTo(400);
        assertThat(request("POST","/api/customers",token,Map.of("name","valid","unknown","bad")).status).isEqualTo(400);
        String supplier="Supplier "+UUID.randomUUID();
        assertThat(request("POST","/api/suppliers",token,Map.of("name",supplier)).status).isEqualTo(201);
        assertThat(get("/api/suppliers?q="+URLEncoder.encode(supplier,java.nio.charset.StandardCharsets.UTF_8)).body.path("totalElements").asInt()).isEqualTo(1);
        Reply rfq=request("POST","/api/rfqs",token,Map.of("customerId",id,"subject","Integration sourcing","quantity",10,"unit","pcs","currency","USD"));
        assertThat(rfq.status).isEqualTo(201);
        assertThat(get("/api/rfqs/"+rfq.body.path("id").asText()).status).isEqualTo(200);
        assertThat(get("/api/dashboard").body.path("customers").asLong()).isGreaterThan(0);
        assertThat(db.queryForObject("SELECT count(*) FROM audit_events WHERE actor=?",Long.class,"test-"+staff)).isGreaterThanOrEqualTo(3);
    }
    @Test void allExistingWorkspaceModulesReadFromMigratedSchema() throws Exception {
        for(String path:List.of("/api/commerce/quotes","/api/commerce/orders","/api/commerce/purchase-orders",
            "/api/logistics/shipments","/api/logistics/consignees","/api/entities","/api/finance/invoices",
            "/api/costs/expenses","/api/costs/profitability","/api/growth/leads","/api/growth/projects","/api/alerts","/api/tasks",
            "/api/staff","/api/audit","/api/command-center/summary")) {
            Reply result=get(path);
            assertThat(result.status).as(path+" "+result.body).isEqualTo(200);
        }
    }
    @Test void commissionRequiresExplicitGrantEvenForAdministrator() throws Exception {
        assertThat(get("/api/costs/commissions/access").body.path("allowed").asBoolean()).isFalse();
        assertThat(get("/api/costs/commissions").status).isEqualTo(403);
        db.update("INSERT INTO staff_permissions(staff_id,permission) VALUES(?,'COMMISSION_ACCESS')",staff);
        assertThat(get("/api/costs/commissions/access").body.path("allowed").asBoolean()).isTrue();
        assertThat(get("/api/costs/commissions").status).isEqualTo(200);
    }
    @Test void revokedSessionsCannotBeReactivatedByReusingJwt() throws Exception {
        assertThat(get("/api/dashboard").status).isEqualTo(200);
        assertThat(get("/api/auth/sessions").body.toString()).contains(session.toString());
        assertThat(request("POST","/api/auth/sessions/current",token,null).status).isEqualTo(200);
        assertThat(get("/api/dashboard").status).isEqualTo(401);
        token=identity.sign(identity.claims(subject,UUID.randomUUID()).build());
        assertThat(get("/api/dashboard").status).isEqualTo(200);
        assertThat(request("DELETE","/api/auth/sessions/"+UUID.randomUUID(),token,null).status).isEqualTo(404);
        assertThat(request("POST","/api/auth/sessions/all",token,null).status).isEqualTo(200);
        assertThat(get("/api/me").status).isEqualTo(401);
        token=identity.sign(identity.claims(subject,UUID.randomUUID()).build());
        assertThat(get("/api/dashboard").status).isEqualTo(401);
    }
    @Test void staffProvisioningAndAccessChangesUseProviderBindings() throws Exception {
        UUID linked=UUID.randomUUID();
        Map<String,Object> input=Map.of("username","linked-"+linked,"supabaseUserId",linked.toString(),"role","BD");
        Reply created=request("POST","/api/staff",token,input);
        assertThat(created.status).isEqualTo(201);
        assertThat(created.body.path("mfa_required").asBoolean()).isTrue();
        assertThat(created.body.has("password_hash")).isFalse();
        assertThat(request("POST","/api/staff",token,input).status).isEqualTo(409);
        assertThat(request("POST","/api/staff",token,Map.of("username","old-password-flow","password","must-never-be-stored","role","BD")).status).isEqualTo(400);
        String linkedToken=identity.sign(identity.claims(linked,UUID.randomUUID()).build());
        assertThat(request("GET","/api/me",linkedToken,null).status).isEqualTo(200);
        assertThat(request("PATCH","/api/staff/"+created.body.path("id").asText()+"/access",token,Map.of("role","SOURCING","enabled",true)).status).isEqualTo(200);
        assertThat(request("GET","/api/me",linkedToken,null).status).isEqualTo(401);
        assertThat(request("PATCH","/api/staff/"+staff+"/access",token,Map.of("role","ADMIN","enabled",false)).status).isEqualTo(409);
    }
    @Test void migrationsAreRepeatableWithoutDataLoss() {
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied()).hasSize(22);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(db.queryForObject("SELECT count(*) FROM staff_users WHERE id=?",Integer.class,staff)).isEqualTo(1);
    }
}
