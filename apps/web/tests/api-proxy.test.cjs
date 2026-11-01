const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-ts.cjs");
const routing = load("../src/lib/api-routing.ts");

test("business route mappings preserve contracts and reject arbitrary destinations", () => {
  for (const [input, expected] of [
    [["data", "dashboard"], "/api/dashboard"], [["data", "me"], "/api/me"],
    [["trading", "rfqs", "stats"], "/api/rfqs/stats"],
    [["enterprise", "logistics", "consignees"], "/api/logistics/consignees"],
    [["growth", "leads"], "/api/growth/leads"], [["costs", "commissions", "access"], "/api/costs/commissions/access"],
    [["command-center"], "/api/command-center/summary"], [["auth", "sessions", "current"], "/api/auth/sessions/current"]
  ]) assert.equal(routing.resolveBusinessPath(input), expected);
  for (const input of [[], ["data", "dashboard", "extra"], ["auth", "admin"], ["enterprise", "unknown"], ["trading", "rfqs", ".."], ["growth", "https://evil.test"], ["data", "customers", "%2f"]])
    assert.equal(routing.resolveBusinessPath(input), null);
  for (const value of [undefined, "http://public.example", "https://user:secret@api.test", "https://api.test/path", "https://api.test/?q=1"])
    assert.equal(routing.backendOrigin(value), null);
  assert.equal(routing.backendOrigin("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
});

test("proxy enforces identity, origins, JSON limits and safe upstream responses", async t => {
  let allowed = true, sameOrigin = true, upstream = async () => Response.json({ customers: 3 });
  let signedOut = false, received;
  const client = { auth: {
    getSession: async () => ({ data: { session: { access_token: "server-only-token" } } }),
    signOut: async () => { signedOut = true; return {}; }
  } };
  const route = load("../src/app/api/[...path]/route.ts", {
    "@/lib/api-routing": routing,
    "@/lib/backend": { backendRequest: async (...args) => { received = args; return upstream(); } },
    "@/lib/session": { sameOrigin: () => sameOrigin },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/supabase/user": { verifiedIdentity: async () => allowed, verifiedUser: async () => allowed }
  });
  const context = { params: Promise.resolve({ path: ["data", "customers"] }) };
  const get = () => route.GET(new Request("http://localhost:3000/api/data/customers?q=a..b", { headers: { cookie: "private-cookie", authorization: "Bearer attacker" } }), context);
  await t.test("forwards only server-verified bearer and query", async () => {
    const result = await get(); assert.equal(result.status, 200);
    assert.equal(received[0], "/api/customers?q=a..b"); assert.equal(received[1], "server-only-token");
    assert.equal(received[2].headers, undefined);
    assert.match(result.headers.get("cache-control"), /no-store/);
    assert.deepEqual(await result.json(), { customers: 3 });
  });
  await t.test("requires identity", async () => { allowed = false; assert.equal((await get()).status, 401); allowed = true; });
  await t.test("rejects cross-origin mutations", async () => {
    sameOrigin = false; assert.equal((await route.POST(new Request("http://localhost/api/data/customers", { method: "POST" }), context)).status, 403); sameOrigin = true;
  });
  await t.test("rejects malformed, non-JSON and oversized bodies", async () => {
    for (const [body, type, status] of [["bad", "application/json", 400], ["{}", "text/plain", 415], ["x".repeat(1_048_577), "application/json", 413]]) {
      const response = await route.POST(new Request("http://localhost/api/data/customers", { method: "POST", headers: { "content-type": type }, body }), context);
      assert.equal(response.status, status);
    }
  });
  await t.test("relays accurate backend failures and expires invalid sessions", async () => {
    for (const status of [401, 403, 404, 409, 500, 503]) {
      upstream = async () => Response.json({ error: "upstream" }, { status });
      assert.equal((await get()).status, status);
    }
    assert.equal(signedOut, true);
  });
  await t.test("invalid JSON, redirects, network and timeout are distinct", async () => {
    for (const [fn, status, code] of [
      [async () => new Response("not json"), 502, "INVALID_UPSTREAM"],
      [async () => new Response(null, { status: 302 }), 502, "INVALID_UPSTREAM"],
      [async () => { throw new TypeError("network"); }, 502, "UPSTREAM_UNAVAILABLE"],
      [async () => { throw new DOMException("timeout", "TimeoutError"); }, 504, "UPSTREAM_TIMEOUT"],
      [async () => { throw new Error("BACKEND_NOT_CONFIGURED"); }, 503, "SERVICE_NOT_CONFIGURED"]
    ]) { upstream = fn; const result = await get(); assert.equal(result.status, status); assert.equal((await result.json()).code, code); }
  });
});

test("identity verification and MFA checks fail closed", async () => {
  const { verifiedUser, verifiedIdentity } = load("../src/lib/supabase/user.ts", {
    "./access": { canAccessWorkspace: email => email === "allowed@example.test" }
  });
  const client = { auth: { getUser: async () => ({ data: { user: { email: "allowed@example.test", factors: [{ status: "verified" }] } } }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1" } }) } } };
  assert.ok(await verifiedIdentity(client)); assert.equal(await verifiedUser(client), null);
  client.auth.mfa.getAuthenticatorAssuranceLevel = async () => { throw new Error("network"); };
  assert.equal(await verifiedUser(client), null);
  client.auth.mfa.getAuthenticatorAssuranceLevel = async () => ({ data: { currentLevel: "aal2" } });
  assert.ok(await verifiedUser(client));
  client.auth.getUser = async () => ({ data: { user: { email: "unknown@example.test" } } });
  assert.equal(await verifiedIdentity(client), null);
});
