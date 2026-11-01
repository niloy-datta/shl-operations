import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { verifiedIdentity } from "@/lib/supabase/user";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && getSupabaseConfig()) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error && await verifiedIdentity(client)) {
      const response = NextResponse.redirect(new URL("/reset-password", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    await client.auth.signOut({ scope: "local" });
  }
  return NextResponse.redirect(new URL("/login?authError=link", request.url));
}
