import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { canAccessWorkspace } from "@/lib/supabase/access";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body || typeof body.accessToken !== "string" || typeof body.refreshToken !== "string" ||
      body.accessToken.length > 16384 || body.refreshToken.length > 4096) {
    return NextResponse.json({ error: "Invalid email link." }, { status: 400 });
  }
  const client = await createClient();
  const verification = await client.auth.getUser(body.accessToken);
  if (verification.error || !canAccessWorkspace(verification.data.user?.email)) {
    return NextResponse.json({ error: "This email link is invalid, expired or not authorized." }, { status: 401 });
  }
  const { data, error } = await client.auth.setSession({ access_token: body.accessToken, refresh_token: body.refreshToken });
  if (error || !data.user || data.user.id !== verification.data.user?.id || !canAccessWorkspace(data.user.email)) {
    await client.auth.signOut({ scope: "local" });
    return NextResponse.json({ error: "This email link has expired. Request a fresh link." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
