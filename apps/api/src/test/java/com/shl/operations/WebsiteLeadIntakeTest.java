package com.shl.operations;

import com.shl.operations.integrations.WebsiteLeadIntakeController;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456",
    "SHL_WEBSITE_INTAKE_SECRET=unit-test-only-not-a-real-secret-longer-than-32"
})
class WebsiteLeadIntakeTest {
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired WebsiteLeadIntakeController intake;
    @Autowired JdbcTemplate db;
    @Autowired WebApplicationContext webContext;

    static String sign(String timestamp,byte[] payload) {
        try {
            Mac mac=Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                "unit-test-only-not-a-real-secret-longer-than-32".getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"));
            mac.update(timestamp.getBytes(StandardCharsets.US_ASCII));
            mac.update((byte)'\n');
            mac.update(payload);
            return "sha256="+HexFormat.of().formatHex(mac.doFinal());
        } catch(Exception e) {throw new IllegalStateException(e);}
    }
    static byte[] payload(String id,String subject) {
        return ("{"+ "\"source\":\"contact\","
            +"\"externalSubmissionId\":\""+id+"\","
            +"\"contactName\":\"Demo User\","
            +"\"contactEmail\":\"demo@example.test\","
            +"\"subject\":\""+subject+"\"}").getBytes(StandardCharsets.UTF_8);
    }

    @Test void authenticatesAndDeduplicatesWebsiteSubmissions() {
        byte[] body=payload("sub_"+UUID.randomUUID().toString().replace("-",""),"Freight inquiry");
        String timestamp=String.valueOf(Instant.now().getEpochSecond());
        var created=intake.receive(timestamp,sign(timestamp,body),body);
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        UUID leadId=(UUID)created.getBody().get("leadId");
        var repeated=intake.receive(timestamp,sign(timestamp,body),body);
        assertThat(repeated.getStatusCode().value()).isEqualTo(200);
        assertThat(repeated.getBody().get("duplicate")).isEqualTo(true);
        assertThat(repeated.getBody().get("leadId")).isEqualTo(leadId);
        assertThat(db.queryForObject("SELECT count(*) FROM crm_leads WHERE id=?",
            Integer.class,leadId)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT source FROM crm_leads WHERE id=?",
            String.class,leadId)).isEqualTo("WEBSITE");
    }

    @Test void rejectsWrongSignatureExpiredTimestampAndReusedId() {
        String id="sub_"+UUID.randomUUID().toString().replace("-","");
        byte[] first=payload(id,"First subject"),changed=payload(id,"Changed subject");
        String now=String.valueOf(Instant.now().getEpochSecond());
        assertThatThrownBy(()->intake.receive(now,"sha256="+"0".repeat(64),first))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("401");
        String stale=String.valueOf(Instant.now().minusSeconds(600).getEpochSecond());
        assertThatThrownBy(()->intake.receive(stale,sign(stale,first),first))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("401");
        intake.receive(now,sign(now,first),first);
        assertThatThrownBy(()->intake.receive(now,sign(now,changed),changed))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409");
    }

    @Test void rejectsMalformedBusinessFields() {
        String id="sub_"+UUID.randomUUID().toString().replace("-","");
        byte[] malformed=payload(id,"");
        String now=String.valueOf(Instant.now().getEpochSecond());
        assertThatThrownBy(()->intake.receive(now,sign(now,malformed),malformed))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("400");
    }

    @Test void httpRouteRequiresHmacEvenWithoutStaffSession() throws Exception {
        MockMvc mvc=MockMvcBuilders.webAppContextSetup(webContext).apply(springSecurity()).build();
        byte[] body=payload("sub_"+UUID.randomUUID().toString().replace("-",""),"HTTP route");
        String now=String.valueOf(Instant.now().getEpochSecond());
        mvc.perform(post("/api/integrations/website/leads")
            .contentType("application/json").content(body)
            .header("X-SHL-Timestamp",now)
            .header("X-SHL-Signature","sha256="+"0".repeat(64)))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/integrations/website/leads")
            .contentType("application/json").content(body)
            .header("X-SHL-Timestamp",now)
            .header("X-SHL-Signature",sign(now,body)))
            .andExpect(status().isCreated());
        mvc.perform(post("/api/integrations/website/leads")
            .contentType("application/json").content(body)
            .header("X-SHL-Timestamp",now)
            .header("X-SHL-Signature",sign(now,body)))
            .andExpect(status().isOk());
    }
}
