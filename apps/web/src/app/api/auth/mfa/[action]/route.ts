import { NextResponse } from "next/server";
import { createClient as createVerifier } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { verifiedIdentity } from "@/lib/supabase/user";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { sameOrigin } from "@/lib/session";
import { backendRequest, revokeBackendSessions } from "@/lib/backend";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function mfaRequired(accessToken: string) {
  if (!process.env.API_INTERNAL_URL) return true;
  try {
    const response = await backendRequest("/api/me", accessToken);
    const data = await response.json();
    return !response.ok || data.mfaRequired !== false;
  } catch { return true; }
}

async function handle(request: Request, context: { params: Promise<{ action: string }> }) {
  if (request.method === "POST" && !sameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const config = getSupabaseConfig();
  if (!config) return reply({ error: "Supabase is not configured." }, 503);
  const client = await createClient();
  const user = await verifiedIdentity(client);
  if (!user?.email) return reply({ error: "Sign in required." }, 401);
  const { data: session } = await client.auth.getSession();
  if (!session.session) return reply({ error: "Sign in again." }, 401);
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) return reply({ error: "Authenticator settings could not be verified." }, 503);
  const factor = factors.data.totp.find(item => item.status === "verified");
  const action = (await context.params).action;
  if (request.method === "GET" && action === "status") {
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) return reply({ error: "Account security could not be verified." }, 503);
    return reply({ enabled: !!factor, enrollmentPending: factors.data.all.some(item => item.factor_type === "totp" && item.status === "unverified"),
      required: await mfaRequired(session.session.access_token), verified: assurance.data.currentLevel === "aal2" });
  }
  if (request.method !== "POST" || !["enroll", "confirm", "challenge", "disable"].includes(action)) return reply({ error: "Endpoint not found." }, 404);
  let body;
  try { body = await request.json(); } catch { return reply({ error: "Invalid request body." }, 400); }
  if (!body || typeof body !== "object") return reply({ error: "Invalid request body." }, 400);
  if (action === "enroll" || action === "disable") {
    if (typeof body.password !== "string" || !body.password || body.password.length > 1024) return reply({ error: "Enter your current password." }, 400);
    const verifier = createVerifier(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const check = await verifier.auth.signInWithPassword({ email: user.email, password: body.password });
    if (check.error) return reply({ error: "Current password could not be verified." }, check.error.status === 429 ? 429 : 400);
    await verifier.auth.signOut({ scope: "local" });
  }
  if (action === "enroll") {
    if (factor) return reply({ error: "An authenticator is already enabled." }, 409);
    for (const pending of factors.data.all.filter(item => item.factor_type === "totp" && item.status === "unverified" && item.friendly_name === "Northstar authenticator")) {
      const removed = await client.auth.mfa.unenroll({ factorId: pending.id });
      if (removed.error) return reply({ error: "The previous enrollment could not be cleared." }, 503);
    }
    const enrollment = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Northstar authenticator" });
    if (enrollment.error) return reply({ error: "Authenticator enrollment is unavailable. Please try again." }, 400);
    return reply({ factorId: enrollment.data.id, secret: enrollment.data.totp.secret, otpAuthUrl: enrollment.data.totp.uri });
  }
  if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) return reply({ error: "Enter the current six-digit authenticator code." }, 400);
  const factorId = action === "confirm" ? body.factorId : factor?.id;
  if (typeof factorId !== "string" || !factors.data.all.some(item => item.factor_type === "totp" && item.id === factorId)) return reply({ error: "Start authenticator setup again." }, 400);
  if (action === "disable" && await mfaRequired(session.session.access_token)) return reply({ error: "MFA is required by your workspace policy." }, 403);
  const verification = await client.auth.mfa.challengeAndVerify({ factorId, code: body.code });
  if (verification.error) return reply({ error: "Invalid or expired authenticator code." }, verification.error.status === 429 ? 429 : 400);
  if (action === "disable") {
    const removed = await client.auth.mfa.unenroll({ factorId });
    if (removed.error) return reply({ error: "The authenticator could not be disabled." }, 400);
    const revoked = await revokeBackendSessions(verification.data.access_token, true);
    const signedOut = await client.auth.signOut({ scope: "global" });
    if (!revoked || signedOut.error) return reply({ error: "MFA was disabled, but session revocation could not be confirmed. Sign out again." }, 503);
  }
  return reply({ ok: true });
}

export { handle as GET, handle as POST };
