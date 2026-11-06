import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiFor, json, noPageOverflow, totp, unique, useRole, type Role } from "./support";

test("real browser login, mandatory MFA enrollment, recovery login and logout", async ({ page }) => {
  const admin = await apiFor();
  const username = "e2e_browser_" + Date.now();
  const password = "Synthetic-browser-only-" + Date.now();
  await json(admin, "/api/enterprise/staff", "POST", { username, password, role: "BD" });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Invalid credentials");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/enroll-mfa/);
  expect((await page.request.get("/api/data/customers")).status()).toBe(403);
  await page.getByLabel("Confirm current password", { exact: true }).fill(password);
  const enrollment = page.waitForResponse(response => response.url().endsWith("/api/auth/mfa/enroll"));
  await page.getByRole("button", { name: /Begin|Start|Set up/i }).click();
  const secret = (await (await enrollment).json()).secret;
  await page.getByLabel("Authenticator code", { exact: true }).fill(totp(secret));
  const confirmation = page.waitForResponse(response => response.url().endsWith("/api/auth/mfa/confirm"));
  await page.getByRole("button", { name: /Verify and enable MFA/ }).click();
  const recovery = (await (await confirmation).json()).recoveryCodes;
  await page.getByRole("button", { name: /I saved my codes/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Authenticator or recovery code").fill(recovery[0]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("button", { name: "Jump to anything" })).toBeVisible();
  const session = (await page.context().cookies()).find(cookie => cookie.name === "shl_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.secure).toBe(true);
  expect(session?.sameSite).toBe("Strict");
  await page.getByRole("button", { name: "Sign out", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/data/customers")).status()).toBe(401);
  expect((await page.request.post("/api/auth/login", { headers: { origin: new URL(page.url()).origin }, data: { username, password, code: recovery[0] } })).status()).toBe(401);
  await admin.dispose();
});

test("desktop/tablet/mobile module pages render live data without page errors or overflow", async ({ page }, testInfo) => {
  await useRole(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const path of ["/workspace", "/workspace/command-center", "/workspace/growth/leads", "/workspace/rfqs",
    "/workspace/enterprise/orders", "/workspace/enterprise/purchase-orders", "/workspace/enterprise/shipments", "/workspace/shipments/line",
    "/workspace/suppliers/compliance", "/workspace/enterprise/invoices", "/workspace/enterprise/staff", "/workspace/alerts"]) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.getByRole("button", { name: "Jump to anything" })).toBeVisible();
      await noPageOverflow(page);
      if (["/workspace", "/workspace/shipments/line"].includes(path)) {
        await testInfo.attach(path.replaceAll("/", "_") + ".png", {
          body: await page.screenshot({fullPage:true}), contentType:"image/png",
        });
      }
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
    });
  }
  expect(errors).toEqual([]);
});

test("one command finder supports keyboard search, focus trapping and navigation", async ({ page }) => {
  await useRole(page);
  await page.goto("/workspace");
  const launcher = page.getByRole("button", { name: "Jump to anything" });
  await expect(launcher).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: /Where to/ });
  const search = dialog.getByRole("combobox");
  await expect(search).toBeFocused();
  await search.fill("unmatched navigation query");
  await expect(dialog.getByText("No matching module")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await page.keyboard.press("Control+k");
  await search.fill("alerts");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/workspace\/alerts$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("customer form validates, traps focus, saves to backend and supports search", async ({ page }) => {
  await useRole(page);
  await page.goto("/workspace?view=customers");
  const launch = page.getByRole("button", { name: "Add customer", exact: true });
  await launch.click();
  const dialog = page.getByRole("dialog", { name: "Add customer" });
  await expect(dialog.getByLabel("Name *", { exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Create record" }).click();
  await expect(dialog).toBeVisible();
  expect(await dialog.getByLabel("Name *", { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await dialog.getByRole("button", { name: "Close dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Create record" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(launch).toBeFocused();
  await launch.click();
  const name = unique("browser customer");
  await dialog.getByLabel("Name *", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Create record" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search customers" }).fill(name);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("cell").filter({ has: page.getByText(name, { exact: true }) })).toBeVisible();
  await noPageOverflow(page);
});

test("unavailable alerts never claim an empty successful queue and retry reaches the real API", async ({ page }) => {
  await useRole(page);
  await page.route("**/api/alerts", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Synthetic outage"}' }));
  await page.goto("/workspace/alerts");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Unable to load operational alerts");
  await expect(page.getByText("Your queue is clear", { exact: true })).toHaveCount(0);
  await expect(page.locator(".ax-card strong")).toHaveText(["—", "—", "—"]);
  await page.unroute("**/api/alerts");
  await page.getByRole("button", { name: "Retry alerts" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  await expect(page.locator(".ax-card strong").first()).not.toHaveText("—");
});

test("expired sessions redirect to login through the shared router", async ({ page }) => {
  await page.context().addCookies([{ name: "shl_session", value: "x".repeat(43), domain: "127.0.0.1", path: "/", httpOnly: true, secure: true, sameSite: "Strict" }]);
  await page.goto("/workspace/enterprise/orders");
  await expect(page).toHaveURL(/\/login/);
});

for (const role of ["ADMIN", "MANAGEMENT", "BD", "SOURCING", "LOGISTICS", "FINANCE"] as Role[]) {
  test(`${role}: browser session preserves role restrictions and commission isolation`, async ({ page }) => {
    await useRole(page, role);
    await page.goto("/workspace");
    await expect(page.getByRole("button", { name: "Jump to anything" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Business modules" });
    const toggle = nav.getByRole("button", { name: "Workspace modules" });
    if (await toggle.isVisible()) await toggle.click();
    await expect(nav.getByRole("link", { name: "Commission vault" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Staff & access" })).toHaveCount(role === "ADMIN" ? 1 : 0);
    await expect(nav.getByRole("link", { name: "Finance & invoices" })).toHaveCount(["ADMIN", "MANAGEMENT", "FINANCE"].includes(role) ? 1 : 0);
    expect((await page.request.get("/api/costs/commissions")).status()).toBe(403);
    expect((await page.request.get("/api/enterprise/staff")).status()).toBe(role === "ADMIN" ? 200 : 403);
    expect((await page.request.get("/api/enterprise/finance/summary")).status()).toBe(["ADMIN", "MANAGEMENT", "FINANCE"].includes(role) ? 200 : 403);
    expect((await page.request.get("/api/trading/rfqs")).status()).toBe(["ADMIN", "MANAGEMENT", "BD", "SOURCING"].includes(role) ? 200 : 403);
  });
}

test("workspace and alerts have no serious WCAG A/AA accessibility violations", async ({ page }, testInfo) => {
  await useRole(page);
  for (const path of ["/workspace", "/workspace/alerts"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Jump to anything" })).toBeVisible();
    if (path === "/workspace") await expect(page.locator(".composition-info span").first()).not.toHaveText("—");
    else await expect(page.locator(".ax-card strong").first()).not.toHaveText("—");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    await testInfo.attach("accessibility-" + path.replaceAll("/", "_") + ".json", { body: JSON.stringify(results.violations, null, 2), contentType: "application/json" });
    expect(results.violations.filter(violation => ["critical", "serious"].includes(violation.impact || ""))).toEqual([]);
  }
});

// Real APIs plus deliberately delayed browser frames reproduce the loading race.
test("fast API completion cannot resurrect a directory loading state", async ({ page }) => {
  await useRole(page);
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 200);
    window.cancelAnimationFrame = handle => window.clearTimeout(handle);
  });
  for (const [path, endpoint] of [
    ["/workspace/enterprise/staff", "/api/enterprise/staff?"],
    ["/workspace/growth/leads", "/api/growth/leads?"],
    ["/workspace/rfqs", "/api/trading/rfqs?"],
    ["/workspace/costs/expenses", "/api/costs/expenses?"],
    ["/workspace/shipments/line", "/api/enterprise/logistics/line-shipments?"],
  ]) {
    const loaded = page.waitForResponse(response => response.url().includes(endpoint) && response.ok());
    await page.goto(path);
    await loaded;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await expect(page.getByText(/^(Loading your records…|Loading records…|Loading…|Loading shipments…)$/)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({hasText:/\S/})).toHaveCount(0);
  }
});
