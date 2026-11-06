import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Called only by the loopback-only, disposable-stack MFA smoke test.
export async function verifyWorkspace({ api, cookie, password, sessionCookie, totp }) {
  const pages = ["/workspace", "/workspace?view=customers", "/workspace?view=suppliers",
    "/workspace/command-center", "/workspace/alerts", "/workspace/entities", "/workspace/consignees",
    "/workspace/rfqs", "/workspace/growth/leads", "/workspace/growth/projects",
    "/workspace/enterprise/quotes", "/workspace/enterprise/orders", "/workspace/enterprise/purchase-orders",
    "/workspace/enterprise/shipments", "/workspace/enterprise/invoices", "/workspace/enterprise/tasks",
    "/workspace/enterprise/staff", "/workspace/enterprise/audit", "/workspace/enterprise/line-quotes",
    "/workspace/suppliers/compliance", "/workspace/finance/line-billing", "/workspace/costs/expenses",
    "/workspace/costs/profitability", "/workspace/account", "/workspace/dedup"];
  const root = await api("/");
  assert.equal(root.status, 307);
  assert.equal(new URL(root.headers.get("location"), "http://localhost").pathname, "/workspace");
  for (const page of pages) {
    const anonymous = await api(page);
    assert.equal(anonymous.status, 307, `Anonymous page guard: ${page}`);
    assert.equal(new URL(anonymous.headers.get("location"), "http://localhost").pathname, "/login");
    const authenticated = await api(page, { cookie });
    assert.equal(authenticated.status, 200, `Authenticated route: ${page}`);
    assert.match(authenticated.headers.get("content-type"), /text\/html/);
  }

  const reads = ["data/me", "data/dashboard", "data/customers", "data/suppliers", "alerts", "command-center",
    "growth/leads", "growth/projects", "trading/rfqs", "trading/rfqs/stats", "enterprise/entities",
    "enterprise/commerce/quotes", "enterprise/commerce/orders", "enterprise/commerce/purchase-orders",
    "enterprise/commerce/line-orders", "enterprise/logistics/shipments", "enterprise/logistics/consignees",
    "enterprise/finance/invoices", "enterprise/finance/summary", "enterprise/finance/line-billing",
    "enterprise/finance/line-billing/eligible-orders", "enterprise/tasks", "enterprise/staff", "enterprise/audit",
    "enterprise/dedup/candidates", "costs/expenses", "costs/profitability", "costs/commissions/access"];
  for (const path of reads) {
    const response = await api("/api/" + path, { cookie });
    assert.equal(response.status, 200, `Live API route: ${path}`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    await response.json();
  }
  assert.equal((await api("/api/costs/commissions", { cookie })).status, 403,
    "Administrator role must not grant confidential commission access");

  const id = "00000000-0000-4000-8000-000000000001";
  const mutations = [`growth/leads/${id}/consents`, `growth/leads/${id}/conversion`,
    `enterprise/logistics/line-shipments/${id}/exceptions`, `supplier-compliance/suppliers/${id}/evidence`,
    `trading/rfqs/${id}/landed-cost`, `enterprise/commerce/line-orders/purchase-orders/${id}/production`];
  for (const path of mutations) {
    const response = await api("/api/" + path, { method: "POST", cookie, json: {}, origin: "https://cross-origin.invalid" });
    assert.equal(response.status, 403, `Cross-origin write must be blocked: ${path}`);
  }
  assert.equal((await api("/api/enterprise/staff/export-passwords", { cookie })).status, 404);
  assert.equal((await api("/api/data/customers", { cookie: "shl_session=" + "x".repeat(43) })).status, 401);

  const managers = ["ADMIN", "MANAGEMENT"], commercial = [...managers, "BD", "SOURCING"];
  const contracts = [
    ["command-center", managers, 200], ["growth/leads", [...managers, "BD"], 200],
    ["trading/rfqs", commercial, 200], ["enterprise/finance/summary", [...managers, "FINANCE"], 200],
    ["enterprise/staff", ["ADMIN"], 200], [`growth/leads/${id}/consents`, [...managers, "BD"], 404],
    [`growth/leads/${id}/conversion`, managers, 404],
    [`supplier-compliance/suppliers/${id}/evidence`, commercial, 404],
    [`trading/rfqs/${id}/landed-cost`, commercial, 404],
    [`enterprise/commerce/line-orders/purchase-orders/${id}/reconciliation`, [...managers, "SOURCING"], 404],
    [`enterprise/commerce/line-orders/purchase-orders/${id}/production`, [...managers, "SOURCING"], 404],
  ];
  for (const role of ["MANAGEMENT", "BD", "SOURCING", "LOGISTICS", "FINANCE"]) {
    const username = "smoke_" + role.toLowerCase() + "_" + randomBytes(6).toString("hex");
    const created = await api("/api/enterprise/staff", { cookie, method: "POST", json: { username, password, role } });
    assert.equal(created.status, 201, `Synthetic role account: ${role}`);
    const login = await api("/api/auth/login", { method: "POST", json: { username, password } });
    assert.equal(login.status, 200);
    const restricted = sessionCookie(login);
    const enroll = await api("/api/auth/mfa/enroll", { cookie: restricted, method: "POST", json: { password } });
    assert.equal(enroll.status, 200);
    const secret = (await enroll.json()).secret;
    const confirmed = await api("/api/auth/mfa/confirm", { cookie: restricted, method: "POST", json: { code: totp(secret) } });
    assert.equal(confirmed.status, 200);
    const recovery = (await confirmed.json()).recoveryCodes;
    const verified = await api("/api/auth/login", { method: "POST", json: { username, password, code: recovery[0] } });
    assert.equal(verified.status, 200);
    const roleCookie = sessionCookie(verified);
    for (const [path, roles, permitted] of contracts) {
      assert.equal((await api("/api/" + path, { cookie: roleCookie })).status,
        roles.includes(role) ? permitted : 403, `Role ${role}: ${path}`);
    }
    assert.equal((await api("/api/costs/commissions", { cookie: roleCookie })).status, 403);
    assert.equal((await api("/api/auth/logout", { cookie: roleCookie, method: "POST" })).status, 200);
  }
  console.log(`Verified ${pages.length} page routes, ${reads.length} live API reads, new write origins, and five MFA-authenticated role matrices.`);
}
