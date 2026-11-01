import assert from "node:assert/strict";
import { test } from "node:test";

const base = process.env.AUTH_TEST_URL || "http://localhost:3000";
const origin = process.env.AUTH_TEST_ORIGIN || new URL(base).origin;
const request = (path, options = {}) => fetch(new URL(path, base), { redirect: "manual", ...options });
const post = (path, body, requestOrigin = origin) => request(path, {
  method: "POST",
  headers: { origin: requestOrigin, "content-type": "application/json" },
  body: JSON.stringify(body),
});

test("login renders email/password fields without caching", async () => {
  const response = await request("/login");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const html = await response.text();
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /project is connected/);
});

test("all workspace modules require a verified Supabase session", async () => {
  for (const path of ["/workspace", "/workspace/rfqs", "/workspace/growth/leads", "/workspace/enterprise/orders", "/workspace/account"]) {
    const response = await request(path);
    assert.equal(response.status, 307, path);
    assert.equal(new URL(response.headers.get("location"), base).pathname, "/login", path);
  }
});

test("legacy cookies cannot bypass authentication", async () => {
  const response = await request("/workspace", { headers: { cookie: `shl_session=${"a".repeat(43)}` } });
  assert.equal(response.status, 307);
});

test("business APIs reject unauthenticated access with JSON", async () => {
  for (const path of ["/api/data/dashboard", "/api/data/me", "/api/data/customers", "/api/trading/rfqs", "/api/enterprise/staff", "/api/costs/commissions/access", "/api/auth/sessions", "/api/auth/mfa/status"]) {
    const response = await request(path, { headers: { authorization: "Bearer forged-browser-token" } });
    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).error, "Sign in required.", path);
  }
});

test("auth mutations reject cross-origin requests", async () => {
  for (const path of ["/api/auth/login", "/api/auth/logout", "/api/auth/password"]) {
    assert.equal((await post(path, {}, "https://untrusted.invalid")).status, 403, path);
  }
});

test("login validates missing and malformed input", async () => {
  for (const body of [null, {}, { email: "invalid", password: "example" }, { email: "test@example.com", password: "example", code: "bad" }]) {
    assert.equal((await post("/api/auth/login", body)).status, 400);
  }
  const response = await request("/api/auth/login", { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{" });
  assert.equal(response.status, 400);
});

test("login rejects an unauthorized email", async () => {
  const response = await post("/api/auth/login", { email: "northstar-auth-smoke@example.invalid", password: "invalid-smoke-test-password" });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Check your email and password/);
});

test("account setup and recovery pages are available", async () => {
  for (const path of ["/register", "/forgot-password"]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /type="email"/);
  }
});

test("registration rejects unauthorized email addresses without creating an account", async () => {
  const response = await post("/api/auth/register", { email: "unauthorized@example.invalid", password: "long-but-invalid-password" });
  assert.equal(response.status, 403);
});

test("new auth mutations reject cross-origin requests", async () => {
  for (const path of ["/api/auth/register", "/api/auth/recover", "/api/auth/set-password", "/api/auth/email-session"]) {
    assert.equal((await post(path, {}, "https://untrusted.invalid")).status, 403);
  }
});

test("email sessions reject malformed and forged tokens", async () => {
  assert.equal((await post("/api/auth/email-session", {})).status, 400);
  assert.equal((await post("/api/auth/email-session", { accessToken: "forged-token", refreshToken: "forged-refresh" })).status, 401);
});

test("new auth forms reject malformed input", async () => {
  for (const path of ["/api/auth/register", "/api/auth/recover"]) {
    assert.equal((await post(path, {})).status, 400);
  }
});

test("password setup requires a verified session", async () => {
  assert.equal((await post("/api/auth/set-password", { password: "long-but-invalid-password" })).status, 401);
  const response = await request("/reset-password");
  assert.match(await response.text(), /expired or was opened in another browser/);
});

test("missing email callback code returns a useful login error", async () => {
  const response = await request("/auth/callback");
  assert.equal(response.status, 307);
  const target = new URL(response.headers.get("location"), base);
  assert.equal(target.pathname, "/login");
  assert.equal(target.searchParams.get("authError"), "link");
});

test("password changes require authentication", async () => {
  assert.equal((await post("/api/auth/password", { currentPassword: "old", newPassword: "new" })).status, 401);
});

test("logout is safe for an already signed-out browser", async () => {
  assert.equal((await post("/api/auth/logout", {})).status, 200);
});
