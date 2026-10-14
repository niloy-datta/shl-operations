package com.shl.operations.security;

import com.shl.operations.enterprise.AuditService;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.IntStream;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MfaService {
    private static final String ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private final String encryptionKey;
    private final boolean mfaEnforced;
    private final SecureRandom rng=new SecureRandom();

    public MfaService(JdbcTemplate db, PasswordEncoder passwords, AuditService audit,
        @Value("${MFA_ENCRYPTION_KEY:}") String encryptionKey,
        @Value("${MFA_ENFORCEMENT_ENABLED:false}") boolean mfaEnforced) {
        this.db=db;this.passwords=passwords;this.audit=audit;this.encryptionKey=encryptionKey;this.mfaEnforced=mfaEnforced;
        if (mfaEnforced && !encryptionKey.matches("[0-9a-fA-F]{64}"))
            throw new IllegalStateException(
                "MFA enforcement requires a valid 256-bit encryption key");
    }
    public record Enrollment(String secret,String otpAuthUrl) {}
    public record Status(boolean enabled, boolean enrollmentPending,
        long recoveryCodesRemaining, boolean required) {}

    private byte[] secretKey() {
        if (!encryptionKey.matches("[0-9a-fA-F]{64}"))
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "MFA encryption key is not configured");
        return HexFormat.of().parseHex(encryptionKey);
    }
    private String encrypt(String text) {
        try {
            byte[] iv=new byte[12];rng.nextBytes(iv);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(secretKey(),"AES"),
                new GCMParameterSpec(128,iv));
            byte[] encrypted=cipher.doFinal(text.getBytes(StandardCharsets.UTF_8));
            byte[] joined=ByteBuffer.allocate(iv.length+encrypted.length).put(iv).put(encrypted).array();
            return Base64.getUrlEncoder().withoutPadding().encodeToString(joined);
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("MFA encryption failed",e); }
    }
    private String decrypt(String encoded) {
        try {
            byte[] bytes=Base64.getUrlDecoder().decode(encoded);
            if (bytes.length<29) throw new IllegalArgumentException("Invalid ciphertext");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(secretKey(),"AES"),
                new GCMParameterSpec(128,Arrays.copyOfRange(bytes,0,12)));
            return new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),
                StandardCharsets.UTF_8);
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("MFA secret decryption failed",e); }
    }
    private static String hash(String code) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    private static String base32(byte[] bytes) {
        int buffer=0,bits=0;
        StringBuilder out=new StringBuilder();
        for (byte b:bytes) {
            buffer=(buffer<<8)|(b&255);bits+=8;
            while(bits>=5) {
                out.append(ALPHABET.charAt((buffer>>>(bits-5))&31));bits-=5;
            }
        }
        if (bits>0) out.append(ALPHABET.charAt((buffer<<(5-bits))&31));
        return out.toString();
    }
    private static byte[] fromBase32(String value) {
        int buffer=0,bits=0;
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
        for (char c:value.toUpperCase(Locale.ROOT).toCharArray()) {
            int n=ALPHABET.indexOf(c);
            if (n<0) throw new IllegalArgumentException("Invalid authenticator secret");
            buffer=(buffer<<5)|n;bits+=5;
            if(bits>=8) {
                out.write((buffer>>>(bits-8))&255);bits-=8;
            }
        }
        return out.toByteArray();
    }
    /** RFC 6238 (SHA1/30 seconds/6 digits). Public for deterministic interoperability testing. */
    public static String totpAt(String secret,long counter) {
        try {
            Mac mac=Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(fromBase32(secret),"HmacSHA1"));
            byte[] bytes=mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
            int index=bytes[bytes.length-1]&0xf;
            int number=((bytes[index]&0x7f)<<24)|((bytes[index+1]&0xff)<<16)
                |((bytes[index+2]&0xff)<<8)|(bytes[index+3]&0xff);
            return String.format(Locale.ROOT,"%06d",number%1_000_000);
        } catch (Exception e) { throw new IllegalStateException("TOTP calculation failed",e); }
    }
    private Long matchedStep(String secret,String code,Long last) {
        if (code==null || !code.matches("[0-9]{6}")) return null;
        long current=Instant.now().getEpochSecond()/30;
        for (long step=current-1;step<=current+1;step++) {
            if (last!=null && step<=last) continue;
            if (MessageDigest.isEqual(totpAt(secret,step).getBytes(StandardCharsets.US_ASCII),
                code.getBytes(StandardCharsets.US_ASCII))) return step;
        }
        return null;
    }
    private Map<String,Object> staff(String username) {
        return db.queryForList("SELECT * FROM staff_users WHERE username=? FOR UPDATE",username)
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Account unavailable"));
    }
    private void verifyPassword(Map<String,Object> account,String password) {
        if (password==null || !passwords.matches(password,(String)account.get("password_hash")))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid credentials");
    }
    public Status status(String username) {
        var row=db.queryForMap("""
            SELECT id,mfa_enabled,mfa_pending_at FROM staff_users WHERE username=?
            """,username);
        Long codes=db.queryForObject("""
            SELECT count(*) FROM mfa_recovery_codes WHERE staff_id=? AND used_at IS NULL
            """,Long.class,row.get("id"));
        return new Status(Boolean.TRUE.equals(row.get("mfa_enabled")),
            row.get("mfa_pending_at")!=null &&
                ((java.sql.Timestamp)row.get("mfa_pending_at")).toInstant()
                    .isAfter(Instant.now().minus(10,ChronoUnit.MINUTES)),codes==null?0:codes,mfaEnforced);
    }
    @Transactional
    public Enrollment enroll(String username,String password) {
        var account=staff(username);verifyPassword(account,password);
        if (Boolean.TRUE.equals(account.get("mfa_enabled")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"MFA is already enabled");
        byte[] raw=new byte[20];rng.nextBytes(raw);
        String secret=base32(raw);
        db.update("""
            UPDATE staff_users SET mfa_pending_enc=?,mfa_pending_at=now()
            WHERE id=?
            """,encrypt(secret),account.get("id"));
        String uri="otpauth://totp/SHL%20Operations:"+
            java.net.URLEncoder.encode(username,StandardCharsets.UTF_8)+
            "?secret="+secret+"&issuer=SHL%20Operations&algorithm=SHA1&digits=6&period=30";
        audit.log("MFA_ENROLL_STARTED","STAFF",(UUID)account.get("id"),"Pending setup");
        return new Enrollment(secret,uri);
    }
    @Transactional
    public List<String> confirm(String username,String code) {
        var account=staff(username);
        if (Boolean.TRUE.equals(account.get("mfa_enabled")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"MFA already enabled");
        Object pending=account.get("mfa_pending_enc");
        Object created=account.get("mfa_pending_at");
        if (!(pending instanceof String) || !(created instanceof java.sql.Timestamp) ||
            ((java.sql.Timestamp)created).toInstant().isBefore(
                Instant.now().minus(10,ChronoUnit.MINUTES)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Start a new MFA setup");
        String secret=decrypt((String)pending);
        Long step=matchedStep(secret,code,null);
        if (step==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid code");
        UUID id=(UUID)account.get("id");
        db.update("""
            UPDATE staff_users SET mfa_enabled=true,mfa_secret_enc=?,
                mfa_pending_enc=NULL,mfa_pending_at=NULL,mfa_last_step=? WHERE id=?
            """,encrypt(secret),step,id);
        List<String> codes=new ArrayList<>();
        for (int i=0;i<8;i++) {
            byte[] raw=new byte[10];rng.nextBytes(raw);
            String body=base32(raw);
            String displayed=body.substring(0,4)+"-"+body.substring(4,8)+"-"+
                body.substring(8,12)+"-"+body.substring(12,16);
            db.update("""
                INSERT INTO mfa_recovery_codes(id,staff_id,code_hash) VALUES(?,?,?)
                """,UUID.randomUUID(),id,hash(body));
            codes.add(displayed);
        }
        // Any password-only sessions must not survive MFA activation.
        db.update("UPDATE auth_sessions SET revoked_at=now() WHERE staff_id=? AND revoked_at IS NULL",id);
        audit.log("MFA_ENABLED","STAFF",id,"Recovery codes issued; sessions revoked");
        return codes;
    }
    /** Caller holds the login rate-limiter row lock; the staff row serializes code reuse. */
    @Transactional
    public boolean verify(UUID staffId,String code) {
        var row=db.queryForList("""
            SELECT mfa_enabled,mfa_secret_enc,mfa_last_step FROM staff_users WHERE id=? FOR UPDATE
            """,staffId).stream().findFirst().orElse(null);
        if (row==null || !Boolean.TRUE.equals(row.get("mfa_enabled"))) return false;
        String value=code==null?"":code.trim().toUpperCase(Locale.ROOT);
        if (value.matches("[A-Z2-7]{4}(-?[A-Z2-7]{4}){3}")) {
            String digest=hash(value.replace("-",""));
            List<UUID> ids=db.query("""
                SELECT id FROM mfa_recovery_codes WHERE staff_id=? AND code_hash=?
                AND used_at IS NULL FOR UPDATE
                """,(rs,i)->rs.getObject(1,UUID.class),staffId,digest);
            if (ids.isEmpty()) return false;
            db.update("UPDATE mfa_recovery_codes SET used_at=now() WHERE id=?",ids.getFirst());
            audit.log("MFA_RECOVERY_USED","STAFF",staffId,"Recovery code consumed");
            return true;
        }
        if (!(row.get("mfa_secret_enc") instanceof String encrypted)) return false;
        Long last=(Long)row.get("mfa_last_step");
        Long step=matchedStep(decrypt(encrypted),value,last);
        if (step==null) return false;
        db.update("UPDATE staff_users SET mfa_last_step=? WHERE id=?",step,staffId);
        return true;
    }
    @Transactional
    public void disable(String username,String password,String code) {
        if (mfaEnforced)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "MFA cannot be disabled while organization enforcement is active");
        var account=staff(username);verifyPassword(account,password);
        UUID id=(UUID)account.get("id");
        if (!Boolean.TRUE.equals(account.get("mfa_enabled")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"MFA not enabled");
        if (!verify(id,code)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid code");
        db.update("""
            UPDATE staff_users SET mfa_enabled=false,mfa_secret_enc=NULL,mfa_pending_enc=NULL,
                mfa_pending_at=NULL,mfa_last_step=NULL WHERE id=?
            """,id);
        db.update("DELETE FROM mfa_recovery_codes WHERE staff_id=?",id);
        db.update("UPDATE auth_sessions SET revoked_at=now() WHERE staff_id=? AND revoked_at IS NULL",id);
        audit.log("MFA_DISABLED","STAFF",id,"All sessions revoked");
    }
}
