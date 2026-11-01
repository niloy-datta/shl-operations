import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && getSupabaseConfig()) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL("/reset-password", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  return NextResponse.redirect(new URL("/login?authError=link", request.url));
}
