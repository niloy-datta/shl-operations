package com.shl.operations.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jwt.JWTParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.client.RestTemplate;

public final class SupabaseJwtDecoder {
    private SupabaseJwtDecoder() {}

    public static JwtDecoder create(String issuer, String jwksUri, String mode, String publishableKey) {
        URI uri = URI.create(issuer);
        if (!"https".equals(uri.getScheme()) && !("http".equals(uri.getScheme()) &&
                ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost()))))
            throw new IllegalArgumentException("Supabase issuer must use HTTPS or local loopback HTTP");
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(Duration.ofSeconds(30)), new JwtIssuerValidator(issuer), jwt -> {
                try {
                    UUID.fromString(jwt.getSubject());
                    UUID.fromString(jwt.getClaimAsString("session_id"));
                    if (jwt.getExpiresAt() == null || jwt.getIssuedAt() == null ||
                        !jwt.getExpiresAt().isAfter(jwt.getIssuedAt()) ||
                        jwt.getIssuedAt().isAfter(Instant.now().plusSeconds(30)) ||
                        !jwt.getAudience().contains("authenticated") ||
                        !"authenticated".equals(jwt.getClaimAsString("role")) ||
                        Boolean.TRUE.equals(jwt.getClaim("is_anonymous"))) throw new IllegalArgumentException();
                    return OAuth2TokenValidatorResult.success();
                } catch (RuntimeException error) {
                    return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Required identity claims are invalid", null));
                }
            });
        if ("jwks".equals(mode)) {
            if (!URI.create(jwksUri).getAuthority().equals(uri.getAuthority()) || !URI.create(jwksUri).getScheme().equals(uri.getScheme()))
                throw new IllegalArgumentException("JWKS must belong to the configured issuer host");
            var requests = new SimpleClientHttpRequestFactory();
            requests.setConnectTimeout(3000); requests.setReadTimeout(5000);
            var decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri)
                .jwsAlgorithms(algorithms -> { algorithms.clear(); algorithms.add(SignatureAlgorithm.ES256); algorithms.add(SignatureAlgorithm.RS256); })
                .restOperations(new RestTemplate(requests)).build();
            decoder.setJwtValidator(validator);
            return decoder;
        }
        if (!"legacy".equals(mode) || publishableKey == null || publishableKey.isBlank())
            throw new IllegalArgumentException("Configure JWKS verification or an explicit legacy Auth-server verifier");
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        ObjectMapper json = new ObjectMapper();
        return token -> {
            try {
                var parsed = JWTParser.parse(token);
                if (!"HS256".equals(parsed.getHeader().getAlgorithm().getName())) throw new JwtException("Unsupported legacy signing algorithm");
                var response = http.send(HttpRequest.newBuilder(URI.create(issuer + "/user"))
                    .timeout(Duration.ofSeconds(5)).header("apikey", publishableKey)
                    .header("Authorization", "Bearer " + token).GET().build(), HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) throw new JwtException("Identity verification failed");
                var claims = MappedJwtClaimSetConverter.withDefaults(Map.of()).convert(parsed.getJWTClaimsSet().getClaims());
                if (!json.readTree(response.body()).path("id").asText().equals(claims.get("sub"))) throw new JwtException("Identity mismatch");
                Jwt jwt = Jwt.withTokenValue(token).headers(headers -> headers.putAll(parsed.getHeader().toJSONObject()))
                    .claims(values -> values.putAll(claims)).build();
                var result = validator.validate(jwt);
                if (result.hasErrors()) throw new JwtValidationException("Invalid identity claims", result.getErrors());
                return jwt;
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt(); throw new JwtException("Identity verification interrupted", error);
            } catch (JwtException error) { throw error; }
            catch (Exception error) { throw new JwtException("Identity verification unavailable", error); }
        };
    }
}
