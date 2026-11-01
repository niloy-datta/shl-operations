import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { error } = await (await createClient()).auth.signOut({ scope: "local" });
  if (error) return NextResponse.json({ error: "Unable to sign out. Please try again." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
