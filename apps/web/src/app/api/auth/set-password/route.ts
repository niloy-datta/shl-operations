import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { verifiedUser } from "@/lib/supabase/user";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { revokeBackendSessions } from "@/lib/backend";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const client = await createClient();
  if (!await verifiedUser(client)) return NextResponse.json({ error: "Open a valid confirmation or password reset link first." }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body || typeof body.password !== "string" || body.password.length < 16 || body.password.length > 128) {
    return NextResponse.json({ error: "Use a password of 16–128 characters." }, { status: 400 });
  }
  const { error } = await client.auth.updateUser({ password: body.password });
  if (error) return NextResponse.json({ error: "Unable to save this password. Choose a different password or request a fresh reset link." }, { status: 400 });
  const session = await client.auth.getSession();
  const revoked = !!session.data.session && await revokeBackendSessions(session.data.session.access_token, true);
  const signout = await client.auth.signOut({ scope: "global" });
  if (!revoked || signout.error) return NextResponse.json({ error: "Password saved, but session revocation could not be confirmed. Please sign out again." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
