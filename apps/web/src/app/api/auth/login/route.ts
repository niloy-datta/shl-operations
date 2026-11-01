import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/session";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { canAccessWorkspace } from "@/lib/supabase/access";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
      body.email.length > 254 || typeof body.password !== "string" || !body.password || body.password.length > 1024 ||
      (body.code !== undefined && (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)))) {
    return NextResponse.json({ error: "Enter a valid email, password and authenticator code if required." }, { status: 400 });
  }
  const client = await createClient();
  if (!canAccessWorkspace(body.email.trim())) return NextResponse.json({ error: "Unable to sign in. Check your email and password." }, { status: 401 });
  const { error } = await client.auth.signInWithPassword({ email: body.email.trim(), password: body.password });
  if (error?.code === "email_not_confirmed") return NextResponse.json({ error: "Confirm your email first. Open the account confirmation email in this browser." }, { status: 401 });
  if (error && (!error.status || error.status >= 500)) return NextResponse.json({ error: "The sign-in service is temporarily unavailable. Please retry later." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.status === 429 ? "Too many attempts. Please try again later." : "Unable to sign in. Check your email and password." }, { status: error.status === 429 ? 429 : 401 });
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) {
    await client.auth.signOut({ scope: "local" });
    return NextResponse.json({ error: "Unable to verify account security." }, { status: 503 });
  }
  const verifiedFactors = factors.data.all.filter(factor => factor.status === "verified");
  if (verifiedFactors.length) {
    const factor = factors.data.totp.find(item => item.status === "verified");
    if (!factor) {
      await client.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "This account requires a sign-in method that is not available here. Contact your administrator." }, { status: 403 });
    }
    if (!body.code) {
      await client.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Authenticator code required." }, { status: 428 });
    }
    const verification = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: body.code });
    if (verification.error) {
      await client.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Invalid or expired authenticator code." }, { status: 401 });
    }
  }
  return NextResponse.json({ ok: true });
}
