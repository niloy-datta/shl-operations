import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const base = process.env.SHL_TEST_BASE_URL || "http://127.0.0.1:3000";
const url = new URL(base);
if (url.protocol !== "http:" || !["localhost","127.0.0.1"].includes(url.hostname)) {
  throw new Error("Smoke tests run only against an isolated local Docker Compose stack");
}
const username = process.env.SHL_TEST_ADMIN_USERNAME;
const password = process.env.SHL_TEST_ADMIN_PASSWORD;
if (!username || !password) throw new Error("Synthetic integration user/password required");

async function api(path, { method = "GET", cookie, json, origin = url.origin } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (method !== "GET") headers.origin = origin;
  if (json !== undefined) headers["content-type"] = "application/json";
  return fetch(new URL(path, url), {
    method, headers, body: json === undefined ? undefined : JSON.stringify(json),
    cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "manual"
  });
}

function sessionCookie(response) {
  const cookie = response.headers.get("set-cookie")?.split(";",1)[0];
  assert.match(cookie || "", /^shl_session=[A-Za-z0-9_-]{43}$/);
  return cookie;
}

function base32Decode(secret) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let value = 0, bits = 0;
  const result = [];
  for (const char of secret.toUpperCase()) {
    const index = chars.indexOf(char);
    if (index < 0) throw new Error("Invalid Base32 authenticator secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(result);
}

function totp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1",base32Decode(secret)).update(counter).digest();
  const index = digest[digest.length - 1] & 15;
  const number = ((digest[index] & 127) << 24) | (digest[index+1] << 16)
    | (digest[index+2] << 8) | digest[index+3];
  return String(number % 1_000_000).padStart(6,"0");
}

test("real Next.js BFF -> Spring Boot -> PostgreSQL MFA lifecycle", async () => {
  const before = await api("/api/data/customers");
  assert.equal(before.status,401,"Anonymous requests must not access customer records");

  const denied = await api("/api/auth/login",{
    method:"POST",origin:"https://malicious.invalid",json:{username,password}
  });
  assert.equal(denied.status,403,"Cross-origin login must be blocked");

  const login = await api("/api/auth/login",{
    method:"POST",json:{username,password}
  });
  assert.equal(login.status,200,"Synthetic bootstrap staff login failed");
  const loginData = await login.json();
  assert.equal(loginData.enrollmentRequired,true,"Mandatory MFA must be enforced");
  const restrictedCookie=sessionCookie(login);

  const restricted = await api("/api/data/customers",{cookie:restrictedCookie});
  assert.equal(restricted.status,403,"Password-only sessions must not browse business records");

  const status = await api("/api/auth/mfa/status",{cookie:restrictedCookie});
  assert.equal(status.status,200);
  assert.equal((await status.json()).required,true);

  const enroll = await api("/api/auth/mfa/enroll",{
    method:"POST",cookie:restrictedCookie,json:{password}
  });
  assert.equal(enroll.status,200,"Authenticator enrollment must be allowed");
  const enrollment = await enroll.json();
  assert.match(enrollment.secret,/^[A-Z2-7]{32}$/);

  const confirm = await api("/api/auth/mfa/confirm",{
    method:"POST",cookie:restrictedCookie,json:{code:totp(enrollment.secret)}
  });
  assert.equal(confirm.status,200,"Authenticator confirmation failed");
  const recovery=(await confirm.json()).recoveryCodes;
  assert.ok(Array.isArray(recovery) && recovery.length===8);

  const revoked = await api("/api/data/customers",{cookie:restrictedCookie});
  assert.equal(revoked.status,401,"Old session must be revoked when MFA is activated");

  const verified = await api("/api/auth/login",{
    method:"POST",json:{username,password,code:recovery[0]}
  });
  assert.equal(verified.status,200,"Recovery-code login failed");
  assert.equal((await verified.json()).enrollmentRequired,false);
  const verifiedCookie=sessionCookie(verified);
  assert.equal((await api("/api/data/customers",{cookie:verifiedCookie})).status,200);

  const replay=await api("/api/auth/login",{
    method:"POST",json:{username,password,code:recovery[0]}
  });
  assert.equal(replay.status,401,"Recovery codes must not be reused");

  const logout=await api("/api/auth/logout",{method:"POST",cookie:verifiedCookie});
  assert.equal(logout.status,200);
  assert.equal((await api("/api/data/customers",{cookie:verifiedCookie})).status,401,
    "Revoked sessions must not access API data");
});
