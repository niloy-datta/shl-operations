import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { authDir, baseURL, totp, type Account, type Accounts, type Role } from "./support";

export default async function setup() {
  const origin = new URL(baseURL);
  if (process.env.SHL_E2E_CONFIRM_DISPOSABLE !== "1" || origin.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(origin.hostname))
    throw new Error("E2E writes require SHL_E2E_CONFIRM_DISPOSABLE=1 and an isolated loopback stack");
  const username = process.env.SHL_TEST_ADMIN_USERNAME;
  const password = process.env.SHL_TEST_ADMIN_PASSWORD;
  if (!username || !password) throw new Error("Synthetic bootstrap credentials required");
  mkdirSync(authDir, { recursive: true });
  const accountFile = resolve(authDir, "accounts.json");
  if (existsSync(accountFile)) {
    const previous: Accounts = JSON.parse(readFileSync(accountFile, "utf8"));
    const valid = await fetch(new URL("/api/data/me", baseURL), { headers: { cookie: previous.ADMIN.cookie } });
    if (previous.ADMIN.username === username && valid.ok) return;
  }
  async function call(path: string, data?: unknown, cookie?: string) {
    const response = await fetch(new URL(path, baseURL), {
      method: data === undefined ? "GET" : "POST",
      headers: { origin: origin.origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Synthetic setup ${path}: HTTP ${response.status}`);
    return response;
  }
  const session = (response: Response) => {
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie?.match(/^shl_session=[A-Za-z0-9_-]{43}$/)) throw new Error("No valid synthetic session cookie");
    return cookie;
  };
  async function enroll(name: string, pass: string, role: string): Promise<Account> {
    const first = await call("/api/auth/login", { username: name, password: pass });
    const restricted = session(first);
    const enrollment = await (await call("/api/auth/mfa/enroll", { password: pass }, restricted)).json();
    const confirmed = await (await call("/api/auth/mfa/confirm", { code: totp(enrollment.secret) }, restricted)).json();
    const verified = session(await call("/api/auth/login", { username: name, password: pass, code: confirmed.recoveryCodes[0] }));
    const state = resolve(authDir, role + ".json");
    writeFileSync(state, JSON.stringify({ cookies: [{ name: "shl_session", value: verified.split("=")[1],
      domain: origin.hostname, path: "/", expires: Math.floor(Date.now() / 1000) + 28_800,
      httpOnly: true, secure: true, sameSite: "Strict" }], origins: [] }), { mode: 0o600 });
    return { username: name, password: pass, cookie: verified, state };
  }
  const result = {} as Accounts;
  result.ADMIN = await enroll(username, password, "ADMIN");
  for (const role of ["MANAGEMENT", "BD", "SOURCING", "LOGISTICS", "FINANCE", "REVIEWER"] as const) {
    const name = `e2e_${role.toLowerCase()}_${randomBytes(4).toString("hex")}`;
    const pass = randomBytes(24).toString("hex");
    await call("/api/enterprise/staff", { username: name, password: pass, role: role === "REVIEWER" ? "ADMIN" : role as Role }, result.ADMIN.cookie);
    result[role] = await enroll(name, pass, role);
  }
  writeFileSync(accountFile, JSON.stringify(result), { mode: 0o600 });
}
