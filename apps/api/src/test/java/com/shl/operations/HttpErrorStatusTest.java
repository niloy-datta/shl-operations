package com.shl.operations;

import com.shl.operations.security.SessionService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

// A real servlet container is essential: MockMvc does not perform the /error redispatch.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "BOOTSTRAP_ADMIN_USERNAME=http-status-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=synthetic-http-status-password"
})
class HttpErrorStatusTest {
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.6");
    static { postgres.start(); }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }

    @LocalServerPort int port;
    @Autowired SessionService sessions;
    @Autowired JdbcTemplate db;
    @Autowired PasswordEncoder passwords;
    final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> request(String path, String token, String json) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (json != null) request.header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void errorDispatchKeepsStatusWithoutGrantingDirectErrorAccess() throws Exception {
        String token = sessions.login("http-status-admin", "synthetic-http-status-password").token();
        assertThat(request("/api/customers", null, null).statusCode()).isEqualTo(401);
        assertThat(request("/api/costs/commissions", token, null).statusCode()).isEqualTo(403);
        var missing = request("/api/growth/leads/" + UUID.randomUUID() + "/conversion", token, null);
        assertThat(missing.statusCode()).isEqualTo(404);
        assertThat(missing.body()).doesNotContain("password_hash", "stackTrace", "Lead not found");
        assertThat(request("/api/growth/leads", token, "{}").statusCode()).isEqualTo(400);
        assertThat(request("/error", null, null).statusCode()).isEqualTo(401);
        assertThat(request("/error", token, null).statusCode()).isEqualTo(403);

        String name = "http-bd-" + UUID.randomUUID().toString().substring(0, 8);
        db.update("INSERT INTO staff_users(id,username,password_hash,role,enabled) VALUES (?,?,?,'BD',true)",
            UUID.randomUUID(), name, passwords.encode("synthetic-bd-status-password"));
        String bd = sessions.login(name, "synthetic-bd-status-password").token();
        assertThat(request("/api/finance/summary", bd, null).statusCode()).isEqualTo(403);
        assertThat(request("/api/growth/leads", bd, null).statusCode()).isEqualTo(200);
    }
}
