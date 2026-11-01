import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { verifiedUser } from "@/lib/supabase/user";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  const protectedPage = request.nextUrl.pathname.startsWith("/workspace");
  const protectedApi = request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/api/auth/");
  const client = config ? createServerClient(config.url, config.key, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  }) : null;
  const user = client ? await verifiedUser(client) : null;
  let result = response;
  if (!user && protectedPage) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    result = NextResponse.redirect(login);
  } else if (!user && protectedApi) {
    result = NextResponse.json({ error: "Sign in required." }, { status: 401 });
  } else if (user && request.nextUrl.pathname === "/login") {
    const workspace = request.nextUrl.clone();
    workspace.pathname = "/workspace";
    workspace.search = "";
    result = NextResponse.redirect(workspace);
  }
  if (result !== response) {
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
  }
  result.headers.set("Cache-Control", "private, no-store");
  result.headers.set("Pragma", "no-cache");
  result.headers.set("Expires", "0");
  return result;
}

export const config = { matcher: ["/workspace/:path*", "/login", "/reset-password", "/auth/:path*", "/api/:path*"] };
