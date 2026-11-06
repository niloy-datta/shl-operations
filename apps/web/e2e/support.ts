import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export type Role = "ADMIN" | "MANAGEMENT" | "BD" | "SOURCING" | "LOGISTICS" | "FINANCE";
export type Account = { username: string; password: string; cookie: string; state: string };
export type Accounts = Record<Role | "REVIEWER", Account>;
export const authDir = resolve(process.cwd(), "e2e/.auth");
export const baseURL = process.env.SHL_TEST_BASE_URL || "http://127.0.0.1:3107";
export const unique = (prefix: string) => `E2E ${prefix} ${randomBytes(5).toString("hex")}`;
export const accounts = (): Accounts => JSON.parse(readFileSync(resolve(authDir, "accounts.json"), "utf8"));

export function totp(secret: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let value = 0, bits = 0;
  const bytes: number[] = [];
  for (const char of secret.toUpperCase()) {
    const index = chars.indexOf(char);
    if (index < 0) throw new Error("Invalid synthetic authenticator secret");
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

export async function apiFor(role: Role | "REVIEWER" = "ADMIN"): Promise<APIRequestContext> {
  return request.newContext({ baseURL, extraHTTPHeaders: { origin: new URL(baseURL).origin, cookie: accounts()[role].cookie } });
}

export async function json<T = Record<string, unknown>>(api: APIRequestContext, path: string,
  method = "GET", data?: unknown, expected?: number): Promise<T> {
  const response = await api.fetch(path, { method, ...(data === undefined ? {} : { data }) });
  if (expected !== undefined) expect(response.status(), `${method} ${path}`).toBe(expected);
  else expect(response.ok(), `${method} ${path}: HTTP ${response.status()}`).toBeTruthy();
  return response.status() === 204 ? undefined as T : await response.json() as T;
}

export async function useRole(page: Page, role: Role | "REVIEWER" = "ADMIN") {
  const state = JSON.parse(readFileSync(accounts()[role].state, "utf8"));
  await page.context().clearCookies();
  await page.context().addCookies(state.cookies);
}

export async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    "The page should fit its viewport; tables may scroll inside their own containers").toBeTruthy();
}

export async function seedQuote(api: APIRequestContext) {
  const customer = await json<{id: string}>(api, "/api/data/customers", "POST", { name: unique("buyer"), country: "BD" });
  const supplier = await json<{id: string; name: string}>(api, "/api/data/suppliers", "POST", { name: unique("supplier"), country: "CN" });
  const rfq = await json<{id: string}>(api, "/api/trading/rfqs", "POST", {
    customerId: customer.id, subject: unique("RFQ"), details: "Synthetic browser workflow", quantity: 10, unit: "PCS", currency: "USD",
  });
  const item = await json<{id: string}>(api, `/api/trading/rfqs/${rfq.id}/items`, "POST", {
    productName: "Synthetic steel plate", specifications: "Test-only specification", hsCode: "7208", quantity: 10,
    unit: "PCS", targetUnitPrice: null, originCountry: "CN", targetDestination: "BD",
  });
  await json(api, `/api/trading/rfqs/${rfq.id}/status`, "PATCH", { status: "SOURCING" });
  const source = await json<{id: string}>(api, `/api/trading/rfqs/${rfq.id}/line-offers`, "POST", {
    itemId: item.id, supplierId: supplier.id, unitPrice: 100, moq: 1, leadDays: 10, incoterm: "FOB", port: "Shanghai", notes: "Synthetic supplier price",
  });
  const draft = await json<{quote: {id: string}}>(api, "/api/enterprise/commerce/line-quotes", "POST", {
    rfqId: rfq.id, items: [{ itemId: item.id, sourceRevisionId: source.id, sellUnitPrice: 125 }],
  });
  return { customer, supplier, rfq, item, quote: draft.quote };
}
