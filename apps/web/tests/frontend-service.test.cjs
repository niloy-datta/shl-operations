const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const typescript = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/frontend-service.ts");
const source = typescript.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 }
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(source, filename);
const { readService, isTotals, isContactPage } = loaded.exports;

test("frontend services distinguish failures and retain independent results", async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const signal = new AbortController().signal;

  for (const [status, title] of [[401, "Session expired"], [403, "Access restricted"], [404, "Service not connected yet"], [500, "Service temporarily unavailable"]]) {
    await t.test(`HTTP ${status}`, async () => {
      global.fetch = async () => new Response("", { status });
      await assert.rejects(readService("/service", signal, isTotals), error =>
        error.issue.title === title && (status !== 401 || error.issue.unauthorized === true));
    });
  }
  await t.test("network failure", async () => {
    global.fetch = async () => { throw new TypeError("network failure"); };
    await assert.rejects(readService("/service", signal, isTotals), error => error.issue.title === "Connection problem");
  });
  await t.test("invalid JSON and unexpected shape", async () => {
    global.fetch = async () => new Response("not JSON", { status: 200 });
    await assert.rejects(readService("/service", signal, isTotals), error => error.issue.message.includes("invalid JSON"));
    global.fetch = async () => Response.json({ customers: 1 });
    await assert.rejects(readService("/service", signal, isTotals), error => error.issue.message.includes("unexpected format"));
  });
  await t.test("empty successful directory is valid", async () => {
    global.fetch = async () => Response.json({ content: [], totalElements: 0, totalPages: 0 });
    assert.deepEqual(await readService("/customers", signal, isContactPage), { content: [], totalElements: 0, totalPages: 0 });
  });
  await t.test("one unavailable service does not discard another result", async () => {
    global.fetch = async url => url === "/dashboard" ? new Response("", { status: 404 }) :
      Response.json({ content: [], totalElements: 0, totalPages: 0 });
    const [dashboard, directory] = await Promise.allSettled([
      readService("/dashboard", signal, isTotals), readService("/customers", signal, isContactPage)
    ]);
    assert.equal(dashboard.status, "rejected");
    assert.equal(directory.status, "fulfilled");
    assert.equal(directory.value.totalElements, 0);
  });
  await t.test("an aborted request is not reported as a network failure", async () => {
    const controller = new AbortController(); controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    global.fetch = async () => { throw abort; };
    await assert.rejects(readService("/service", controller.signal, isTotals), error => error === abort);
  });
  await t.test("an explicit retry can succeed after a failure", async () => {
    let attempts = 0;
    global.fetch = async () => ++attempts === 1 ? new Response("", { status: 404 }) : Response.json({ customers: 2, suppliers: 3, rfqs: 1 });
    await assert.rejects(readService("/dashboard", signal, isTotals));
    assert.deepEqual(await readService("/dashboard", signal, isTotals), { customers: 2, suppliers: 3, rfqs: 1 });
    assert.equal(attempts, 2);
  });
});
