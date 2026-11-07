import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const token = "a".repeat(43);
const uuid = "00000000-0000-4000-8000-000000000001";

// Execute the real TypeScript handlers with NextResponse and controlled I/O.
// No server or business database is used by these boundary tests.
function load(relative, { cookie, fetch = () => { throw new Error("Unexpected upstream request"); } } = {}) {
  const source = readFileSync(new URL("../src/" + relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const loadedModule = { exports: {} };
  const context = {
    module: loadedModule, exports: loadedModule.exports, URL, URLSearchParams, AbortSignal, fetch,
    process: { env: { API_INTERNAL_URL: "http://backend.test", SHL_PUBLIC_ORIGIN: "http://localhost:3000" } },
    require(name) {
      if (name === "next/headers") return { cookies: async () => ({ get: () => ({ value: cookie }) }) };
      if (name === "@/lib/session") return load("lib/session.ts", { cookie, fetch });
      return require(name);
    },
  };
  vm.runInNewContext(compiled, context, { filename: relative });
  return loadedModule.exports;
}

const routes = [
  ["enterprise", "logistics/line-shipments/eligible-purchase-orders", "GET"],
  ["growth", `leads/${uuid}/consents`, "POST"],
  ["growth", `leads/${uuid}/conversion`, "POST"],
  ["enterprise", `logistics/line-shipments/${uuid}/exceptions`, "POST"],
  ["enterprise", `commerce/line-orders/purchase-orders/${uuid}/reconciliation`, "GET"],
  ["enterprise", `commerce/line-orders/purchase-orders/${uuid}/production`, "GET"],
  ["supplier-compliance", `suppliers/${uuid}/evidence`, "POST"],
  ["trading", `rfqs/${uuid}/landed-cost`, "POST"],
];

for (const [area, path, method] of routes) {
  test(`${area}/${path}: authentication, origin and upstream status are preserved`, async () => {
    const file = `app/api/${area}/[...path]/route.ts`;
    const context = { params: Promise.resolve({ path: path.split("/") }) };
    const request = origin => new Request(`http://localhost:3000/api/${area}/${path}?q=needle`, {
      method, headers: { origin, "content-type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify({ evidence: "synthetic test reference" }) }),
    });
    const anonymous = await load(file)[method](request("http://localhost:3000"), context);
    assert.equal(anonymous.status, 401);
    if (method !== "GET") {
      const rejected = await load(file, { cookie: token })[method](request("https://cross-origin.invalid"), context);
      assert.equal(rejected.status, 403);
    }
    let calls = 0;
    const handler = load(file, { cookie: token, fetch: async (url, options) => {
      calls++;
      assert.ok(String(url).startsWith("http://backend.test/api/"));
      assert.ok(String(url).includes(path));
      assert.equal(options.headers.authorization, "Bearer " + token);
      assert.equal(options.method, method);
      assert.equal(options.cache, "no-store");
      return new Response(JSON.stringify({ error: "Role denied" }), { status: 403 });
    } });
    const response = await handler[method](request("http://localhost:3000"), context);
    assert.equal(calls, 1);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "Role denied" });
  });
}

test("session tokens and CSRF authority reject malformed values and forged hosts", async () => {
  for (const cookie of [undefined, "", "Basic abc", "a".repeat(42), token + "!", "../secret"]) {
    assert.equal(await load("lib/session.ts", { cookie }).sessionAuthorization(), null);
  }
  const session = load("lib/session.ts", { cookie: token });
  assert.equal(await session.sessionAuthorization(), "Bearer " + token);
  assert.equal(session.sameOrigin(new Request("http://internal:3000", {
    headers: { origin: "http://localhost:3000" },
  })), true);
  assert.equal(session.sameOrigin(new Request("http://internal:3000", {
    headers: { origin: "https://attacker.test", host: "attacker.test", "x-forwarded-host": "attacker.test" },
  })), false);
});

test("login distinguishes unavailable service from rejected credentials and keeps tokens HTTP-only", async () => {
  const request = () => new Request("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ username: "synthetic_admin", password: "synthetic-test-password" }),
  });
  for (const [status, expected] of [[401, 401], [428, 428], [429, 429], [500, 503], [503, 503]]) {
    const response = await load("app/api/auth/login/route.ts", { fetch: async () =>
      new Response("{}", { status }),
    }).POST(request());
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("set-cookie"), null);
  }
  const response = await load("app/api/auth/login/route.ts", { fetch: async () =>
    Response.json({ token, username: "synthetic_admin", role: "ADMIN" }),
  }).POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).token, undefined);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=strict/i);
});

test("failed server-side revocation leaves the browser session available for retry", async () => {
  const response = await load("app/api/auth/logout/route.ts", { cookie: token, fetch: async () =>
    new Response("{}", { status: 503 }),
  }).POST(new Request("http://localhost:3000/api/auth/logout", {
    method: "POST", headers: { origin: "http://localhost:3000" },
  }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("directory writes are bounded and upstream network failures become unavailable responses", async () => {
  const context = { params: Promise.resolve({ resource: "customers" }) };
  const request = () => new Request("http://localhost:3000/api/data/customers", {
    method: "POST", headers: { origin: "http://localhost:3000" }, body: "x".repeat(16_385),
  });
  const oversized = await load("app/api/data/[resource]/route.ts", { cookie: token }).POST(request(), context);
  assert.equal(oversized.status, 413);
  const unavailable = await load("app/api/data/[resource]/route.ts", { cookie: token, fetch: async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    throw new Error("Synthetic connection failure");
  } }).GET(new Request("http://localhost:3000/api/data/customers"), context);
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: "Service unavailable" });
});

test("navigation hides restricted modules before identity is known and never infers commission access", () => {
  const { visibleNavigation, navigationMatches } = load("lib/operations-navigation.ts");
  const links = (role, access) => visibleNavigation(role, access).flatMap(group => group.items).map(item => item.href);
  assert.equal(links(null).includes("/workspace/enterprise/staff"), false);
  for (const role of ["ADMIN", "MANAGEMENT", "BD", "SOURCING", "LOGISTICS", "FINANCE"]) {
    assert.equal(links(role).includes("/workspace/costs/commissions"), false);
    assert.equal(links(role, true).includes("/workspace/costs/commissions"), true);
    assert.equal(links(role).includes("/workspace/products"), ["ADMIN","MANAGEMENT","BD","SOURCING"].includes(role));
  }
  assert.equal(links("BD").includes("/workspace/enterprise/invoices"), false);
  assert.equal(links("FINANCE").includes("/workspace/growth/leads"), false);
  assert.equal(links("MANAGEMENT").includes("/workspace/enterprise/staff"), false);
  assert.equal(links("ADMIN").includes("/workspace/enterprise/staff"), true);
  assert.equal(navigationMatches({ label: "RFQ sourcing", description: "Supplier pricing" }, "RFQ supplier"), true);
});

test("workspace overview authenticates and preserves role-denial responses", async () => {
 const req=new Request("http://localhost:3000/api/workspace-overview?scope=team");
 assert.equal((await load("app/api/workspace-overview/route.ts").GET(req)).status,401);
 const response=await load("app/api/workspace-overview/route.ts",{cookie:token,fetch:async(url,options)=>{
  assert.equal(url,"http://backend.test/api/workspace/overview?scope=team");assert.equal(options.headers.authorization,"Bearer "+token);
  return Response.json({error:"Management required"},{status:403});
 }}).GET(req);assert.equal(response.status,403);assert.equal(response.headers.get("cache-control"),"no-store");
});
test("CSV import handles quoted multiline data, malformed rows, bounded size and validation",()=>{
 const {parseContactCsv,contactIssues}=load("lib/contact-import.ts");
 const rows=parseContactCsv('name,email,country\r\n"A, Trading",a@example.test,BD\r\n"B\nCompany",b@example.test,CN');
 assert.equal(rows[1][0],"A, Trading");assert.equal(rows[2][0],"B\nCompany");
 assert.throws(()=>parseContactCsv('name,email\n"unclosed,x'));
 assert.throws(()=>parseContactCsv('name,email\nOnly one column'));
 assert.throws(()=>parseContactCsv('name\n'+Array(101).fill('Company').join('\n')));
 assert.ok(contactIssues({name:"",email:"bad-email",phone:"",country:""}).length===2);
});

test("supplier deep links authenticate and preserve upstream status",async()=>{
 const context={params:Promise.resolve({resource:"suppliers",id:uuid})},request=new Request("http://localhost:3000/api/data/suppliers/"+uuid);
 assert.equal((await load("app/api/data/[resource]/[id]/route.ts").GET(request,context)).status,401);
 const response=await load("app/api/data/[resource]/[id]/route.ts",{cookie:token,fetch:async(url)=>{assert.equal(url,"http://backend.test/api/suppliers/"+uuid);return Response.json({error:"Missing"},{status:404});}}).GET(request,context);
 assert.equal(response.status,404);assert.equal(response.headers.get("cache-control"),"no-store");
});

test("product proxy only forwards approved catalog routes and keeps CSRF, authentication and query boundaries",async()=>{
 const file="app/api/products/[...path]/route.ts",context={params:Promise.resolve({path:["compare"]})};
 const req=new Request(`http://localhost:3000/api/products/compare?ids=${uuid},${uuid}`,{headers:{origin:"http://localhost:3000"}});
 assert.equal((await load(file).GET(req,context)).status,401);
 let target="";
 const response=await load(file,{cookie:token,fetch:async(url,options)=>{target=url;assert.equal(options.headers.authorization,"Bearer "+token);return Response.json({content:[]},{status:200});}}).GET(req,context);
 assert.equal(response.status,200);assert.equal(target,`http://backend.test/api/products/compare?ids=${uuid}%2C${uuid}`);
 const badWrite=await load(file,{cookie:token}).POST(new Request("http://localhost:3000/api/products",{method:"POST",headers:{origin:"https://attacker.test"},body:"{}"}),{params:Promise.resolve({path:["manufacturers"]})});
 assert.equal(badWrite.status,403);
 const badPath=await load(file,{cookie:token}).GET(new Request("http://localhost:3000/api/products/not-a-route"),{params:Promise.resolve({path:["not-a-route"]})});
 assert.equal(badPath.status,404);
});
