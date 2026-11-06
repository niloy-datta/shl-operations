import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  { ignores: ["playwright-report/**", "test-results/**", "e2e/.auth/**"] },
  ...nextVitals, ...nextTs,
]);

