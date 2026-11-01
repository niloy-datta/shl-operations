const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-ts.cjs");

test("password login handles provider errors and MFA without leaving partial sessions", async t => {
  let signInError = null, factorError = null, factors = [], verificationError = null, signouts = 0;
  const client = { auth: {
    signInWithPassword: async () => ({ error: signInError }),
    signOut: async () => { signouts++; return {}; },
    mfa: {
      listFactors: async () => ({ error: factorError, data: { all: factors, totp: factors } }),
      challengeAndVerify: async () => ({ error: verificationError })
    }
  } };
  const route = load("../src/app/api/auth/login/route.ts", {
    "@/lib/session": { sameOrigin: () => true },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({}) },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/supabase/access": { canAccessWorkspace: () => true }
  });
  const login = (code) => route.POST(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "allowed@example.test", password: "test-password-only", ...(code ? { code } : {}) }) }));
  await t.test("valid password with no enrolled factors", async () => { assert.equal((await login()).status, 200); });
  await t.test("invalid credentials and provider rate limit", async () => {
    signInError = { status: 400 }; assert.equal((await login()).status, 401);
    signInError = { status: 429 }; assert.equal((await login()).status, 429);
    signInError = { status: 503 }; assert.equal((await login()).status, 503);
    signInError = null;
  });
  await t.test("factor lookup failure clears partial sign-in", async () => {
    factorError = {}; const before = signouts; assert.equal((await login()).status, 503); assert.equal(signouts, before + 1); factorError = null;
  });
  await t.test("missing and invalid MFA codes clear password-only sessions", async () => {
    factors = [{ id: "factor", status: "verified" }];
    let before = signouts; assert.equal((await login()).status, 428); assert.equal(signouts, before + 1);
    verificationError = {}; before = signouts; assert.equal((await login("123456")).status, 401); assert.equal(signouts, before + 1);
    verificationError = null; assert.equal((await login("123456")).status, 200);
  });
});

test("MFA enrollment confirms the user's pending factor using the SDK all list", async () => {
  let verified;
  const client = { auth: {
    getSession: async () => ({ data: { session: { access_token: "server-token" } } }),
    mfa: {
      listFactors: async () => ({ data: { totp: [], all: [{ id: "pending-id", factor_type: "totp", status: "unverified" }] } }),
      challengeAndVerify: async value => { verified = value; return { data: { access_token: "aal2-token" } }; }
    }
  } };
  const route = load("../src/app/api/auth/mfa/[action]/route.ts", {
    "@supabase/supabase-js": { createClient: () => { throw new Error("not expected for confirmation"); } },
    "@/lib/session": { sameOrigin: () => true },
    "@/lib/backend": {},
    "@/lib/supabase/config": { getSupabaseConfig: () => ({}) },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/supabase/user": { verifiedIdentity: async () => ({ email: "allowed@example.test" }) }
  });
  const confirm = id => route.POST(new Request("http://localhost/api/auth/mfa/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ factorId: id, code: "123456" }) }), { params: Promise.resolve({ action: "confirm" }) });
  assert.equal((await confirm("another-factor")).status, 400);
  assert.equal((await confirm("pending-id")).status, 200);
  assert.deepEqual(verified, { factorId: "pending-id", code: "123456" });
});

test("backend forwarding keeps secrets server-side and reports failed global revocation", async t => {
  const originalFetch = global.fetch;
  const previous = process.env.API_INTERNAL_URL;
  t.after(() => { global.fetch = originalFetch; if (previous === undefined) delete process.env.API_INTERNAL_URL; else process.env.API_INTERNAL_URL = previous; });
  const backend = load("../src/lib/backend.ts", { "server-only": {}, "./api-routing": load("../src/lib/api-routing.ts") });
  process.env.API_INTERNAL_URL = "http://127.0.0.1:8080";
  global.fetch = async (url, options) => {
    assert.equal(url.href, "http://127.0.0.1:8080/api/customers?q=a..b");
    assert.equal(options.headers.get("authorization"), "Bearer verified-token");
    assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "manual");
    return Response.json({});
  };
  await backend.backendRequest("/api/customers?q=a..b", "verified-token");
  global.fetch = async () => new Response(null, { status: 401 });
  assert.equal(await backend.revokeBackendSessions("token"), true);
  assert.equal(await backend.revokeBackendSessions("token", true), false);
  global.fetch = async () => { throw new Error("offline"); };
  assert.equal(await backend.revokeBackendSessions("token", true), false);
});
