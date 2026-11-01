import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/session";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { canAccessWorkspace } from "@/lib/supabase/access";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body || typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
      typeof body.password !== "string" || body.password.length < 16 || body.password.length > 128) {
    return NextResponse.json({ error: "Enter a valid email and a password of 16–128 characters." }, { status: 400 });
  }
  if (!canAccessWorkspace(body.email.trim())) return NextResponse.json({ error: "Account setup is available only for authorized staff email addresses." }, { status: 403 });
  const client = await createClient();
  const { data, error } = await client.auth.signUp({ email: body.email.trim(), password: body.password });
  if (error) return NextResponse.json({ error: error.status === 429 ? "Too many attempts. Please try again later." : "Account setup failed. If your account already exists, use Forgot password." }, { status: error.status === 429 ? 429 : 400 });
  return NextResponse.json({ ok: true, signedIn: Boolean(data.session), message: "Check your email to confirm your account. If it already exists, sign in or use Forgot password." });
}
