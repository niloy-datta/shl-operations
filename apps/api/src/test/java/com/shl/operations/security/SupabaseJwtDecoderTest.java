package com.shl.operations.security;

import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.SignedJWT;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.*;
import static org.assertj.core.api.Assertions.*;

class SupabaseJwtDecoderTest {
    static TestIdentity identity;
    JwtDecoder decoder;
    UUID user=UUID.randomUUID(), session=UUID.randomUUID();
    @BeforeAll static void start() { identity=new TestIdentity(); }
    @AfterAll static void stop() { identity.close(); }
    @BeforeEach void decoder() { decoder=SupabaseJwtDecoder.create(identity.issuer,identity.issuer+"/.well-known/jwks.json","jwks",""); }
    @Test void acceptsValidSignatureAndClaims() {
        assertThat(decoder.decode(identity.sign(identity.claims(user,session).build())).getSubject()).isEqualTo(user.toString());
    }
    @Test void rejectsForgedSignature() throws Exception {
        var forged=identity.sign(identity.claims(user,session).build(),new RSAKeyGenerator(2048).generate());
        assertThatThrownBy(()->decoder.decode(forged)).isInstanceOf(JwtException.class);
    }
    @Test void supportsSupabaseEs256SigningKeys() throws Exception {
        var ec=new ECKeyGenerator(Curve.P_256).keyID("test-ec-key").generate();
        identity.server.createContext("/auth/v1/ec-jwks",exchange->{
            byte[] body=new com.nimbusds.jose.jwk.JWKSet(ec.toPublicJWK()).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();
        });
        var jwt=new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(ec.getKeyID()).build(),identity.claims(user,session).build());
        jwt.sign(new ECDSASigner(ec));
        var ecDecoder=SupabaseJwtDecoder.create(identity.issuer,identity.issuer+"/ec-jwks","jwks","");
        assertThat(ecDecoder.decode(jwt.serialize()).getSubject()).isEqualTo(user.toString());
    }
    @Test void rejectsInvalidIdentityClaims() {
        var invalid=List.of(
            identity.claims(user,session).issuer("https://wrong.example").build(),
            identity.claims(user,session).audience("anon").build(),
            identity.claims(user,session).expirationTime(Date.from(Instant.now().minusSeconds(120))).build(),
            identity.claims(user,session).claim("session_id",null).build(),
            identity.claims(user,session).claim("role","service_role").build(),
            identity.claims(user,session).claim("is_anonymous",true).build(),
            identity.claims(user,session).issueTime(Date.from(Instant.now().plusSeconds(120))).build());
        for(var claims:invalid) assertThatThrownBy(()->decoder.decode(identity.sign(claims))).isInstanceOf(JwtException.class);
    }
    @Test void doesNotDowngradeToSharedSecretVerification() {
        assertThatThrownBy(()->decoder.decode(identity.legacy(identity.claims(user,session).build()))).isInstanceOf(JwtException.class);
        assertThatThrownBy(()->SupabaseJwtDecoder.create(identity.issuer,identity.issuer+"/.well-known/jwks.json","legacy","")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void legacyRequiresOfficialUserEndpointConfirmationAndMatchingIdentity() {
        var legacy=SupabaseJwtDecoder.create(identity.issuer,"","legacy","test-publishable-key");
        String token=identity.legacy(identity.claims(user,session).build());
        identity.legacyStatus=401;
        assertThatThrownBy(()->legacy.decode(token)).isInstanceOf(JwtException.class);
        identity.legacyStatus=200; identity.legacySubject=UUID.randomUUID().toString();
        assertThatThrownBy(()->legacy.decode(token)).isInstanceOf(JwtException.class);
        identity.legacySubject=user.toString();
        assertThat(legacy.decode(token).getSubject()).isEqualTo(user.toString());
        assertThatThrownBy(()->legacy.decode(identity.sign(identity.claims(user,session).build()))).isInstanceOf(JwtException.class);
    }
}
