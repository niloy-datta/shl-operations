import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../.env.e2e", import.meta.url));
const password = randomBytes(24).toString("hex");
const content = {
  POSTGRES_DB: "shl_e2e", POSTGRES_USER: "shl_e2e", POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  BOOTSTRAP_ADMIN_USERNAME: "e2e_admin", BOOTSTRAP_ADMIN_PASSWORD: password,
  MFA_ENCRYPTION_KEY: randomBytes(32).toString("hex"), MFA_ENFORCEMENT_ENABLED: "true",
  SHL_DEPLOYMENT_MODE: "development", SHL_E2E_PORT: "3107", SHL_TEST_BASE_URL: "http://127.0.0.1:3107",
  SHL_TEST_ADMIN_USERNAME: "e2e_admin", SHL_TEST_ADMIN_PASSWORD: password, SHL_E2E_CONFIRM_DISPOSABLE: "1",
};
writeFileSync(target, Object.entries(content).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", {
  flag: "wx", mode: 0o600,
});
console.log("Created private synthetic .env.e2e; existing files are never overwritten.");
