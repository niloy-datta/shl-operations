import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/session";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { verifiedUser } from "@/lib/supabase/user";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const config = getSupabaseConfig();
  if (!config) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const client = await createClient();
  const user = await verifiedUser(client);
  if (!user?.email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body.currentPassword !== "string" || !body.currentPassword || body.currentPassword.length > 1024 ||
      typeof body.newPassword !== "string" || body.newPassword.length < 16 || body.newPassword.length > 128) {
    return NextResponse.json({ error: "Enter your current password and a new password of 16–128 characters." }, { status: 400 });
  }
  const verifier = createSupabaseClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const verification = await verifier.auth.signInWithPassword({ email: user.email, password: body.currentPassword });
  if (verification.error) return NextResponse.json({ error: "Current password could not be verified." }, { status: 400 });
  await verifier.auth.signOut({ scope: "local" });
  const update = await client.auth.updateUser({ password: body.newPassword });
  if (update.error) return NextResponse.json({ error: "Unable to update password. Use a different password or sign in again." }, { status: 400 });
  const signout = await client.auth.signOut({ scope: "global" });
  if (signout.error) return NextResponse.json({ error: "Password changed, but signing out failed. Please sign out again." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
