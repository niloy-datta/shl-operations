import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const env = Object.fromEntries(readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf8")
  .split(/\r?\n/).filter(line => line && !line.startsWith("#") && line.includes("="))
  .map(line => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const owners = (env.SHL_AUTH_ALLOWED_EMAILS || "").split(",").map(value => value.trim()).filter(Boolean);
if (owners.length !== 1) throw new Error("Initial setup requires exactly one configured owner email.");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SHL_PUBLIC_ORIGIN) {
  throw new Error("Configure Supabase and the public app origin first.");
}
// Supabase delivers a one-time sign-in link; the owner chooses their own password.
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
const { error } = await client.auth.signInWithOtp({ email: owners[0], options: {
  shouldCreateUser: true, emailRedirectTo: env.SHL_PUBLIC_ORIGIN,
} });
if (error) { console.error(`Owner setup failed: ${error.message}`); process.exitCode = 1; }
else console.log(`Supabase accepted the account setup email request for ${owners[0]}.`);
