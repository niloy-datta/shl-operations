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
  if (!body || typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (canAccessWorkspace(body.email.trim())) {
    const { error } = await (await createClient()).auth.resetPasswordForEmail(body.email.trim());
    if (error) return NextResponse.json({ error: error.status === 429 ? "Too many attempts. Please try again later." : "Unable to send a reset link. Please try again later." }, { status: error.status === 429 ? 429 : 503 });
  }
  return NextResponse.json({ ok: true, message: "If an authorized account exists, a password reset link has been sent. Open it in this browser." });
}
