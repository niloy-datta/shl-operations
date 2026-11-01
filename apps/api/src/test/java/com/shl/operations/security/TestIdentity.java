package com.shl.operations.security;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

final class TestIdentity implements AutoCloseable {
    final RSAKey key;
    final HttpServer server;
    final String issuer;
    volatile int legacyStatus = 401;
    volatile String legacySubject = "";
    TestIdentity() {
        try {
            key = new RSAKeyGenerator(2048).keyID(UUID.randomUUID().toString()).generate();
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            issuer = "http://127.0.0.1:" + server.getAddress().getPort() + "/auth/v1";
            server.createContext("/auth/v1/.well-known/jwks.json", exchange -> {
                byte[] body = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body); exchange.close();
            });
            server.createContext("/auth/v1/user", exchange -> {
                byte[] body = ("{\"id\":\"" + legacySubject + "\"}").getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(legacyStatus, body.length); exchange.getResponseBody().write(body); exchange.close();
            });
            server.start();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    JWTClaimsSet.Builder claims(UUID subject, UUID session) {
        return new JWTClaimsSet.Builder().issuer(issuer).subject(subject.toString()).audience("authenticated")
            .issueTime(Date.from(Instant.now().minusSeconds(2))).expirationTime(Date.from(Instant.now().plusSeconds(600)))
            .claim("session_id",session.toString()).claim("role","authenticated").claim("aal","aal2");
    }
    String sign(JWTClaimsSet claims) { return sign(claims, key); }
    String sign(JWTClaimsSet claims, RSAKey signingKey) {
        try {
            var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),claims);
            jwt.sign(new RSASSASigner(signingKey)); return jwt.serialize();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    String legacy(JWTClaimsSet claims) {
        try {
            var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256),claims);
            jwt.sign(new MACSigner(new byte[32])); return jwt.serialize();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    public void close() { server.stop(0); }
}
