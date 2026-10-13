import { NextResponse } from "next/server";
import { cookieName, sameOrigin, sessionAuthorization } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const authorization = await sessionAuthorization();
  if (authorization) {
    try {
      const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/auth/sessions/current`, {
        method: "DELETE", headers: { authorization },
        cache: "no-store", signal: AbortSignal.timeout(10_000)
      });
      if (!upstream.ok && upstream.status !== 401)
        return NextResponse.json({ error: "Could not revoke session. Retry sign out." },
          { status: 503, headers: { "cache-control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Could not revoke session. Retry sign out." },
        { status: 503, headers: { "cache-control": "no-store" } });
    }
  }
  const response = NextResponse.json({ ok: true },
    { headers: { "cache-control": "no-store" } });
  response.cookies.delete(cookieName);
  return response;
}
