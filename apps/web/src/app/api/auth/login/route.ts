import { NextResponse } from "next/server";
import { cookieName, sameOrigin, sessionDuration } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  let username: string, password: string, code: string | undefined;
  try {
    const input = await request.json();
    username = input.username;
    password = input.password;
    code = typeof input.code === "string" ? input.code : undefined;
    if (typeof username !== "string" || typeof password !== "string"
      || !username.trim() || username.length > 80 || !password || password.length > 256)
      throw new Error("Invalid input");
  } catch {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/auth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, code }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    if (upstream.status === 428)
      return NextResponse.json({ error: "Authenticator code required", mfaRequired: true },
        { status: 428, headers: { "cache-control": "no-store" } });
    if (upstream.status === 429)
      return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." },
        { status: 429, headers: { "cache-control": "no-store" } });
    if (!upstream.ok)
      return NextResponse.json({ error: "Invalid credentials" },
        { status: 401, headers: { "cache-control": "no-store" } });
    const data: unknown = await upstream.json();
    if (!data || typeof data !== "object") throw new Error("Invalid authentication response");
    const auth = data as Record<string, unknown>;
    if (typeof auth.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(auth.token)
        || typeof auth.username !== "string" || typeof auth.role !== "string")
      throw new Error("Invalid authentication payload");

    // The opaque token is never returned to browser JavaScript.
    const response = NextResponse.json({ username: auth.username, role: auth.role },
      { headers: { "cache-control": "no-store" } });
    response.cookies.set(cookieName, auth.token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/", maxAge: sessionDuration
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Service unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } });
  }
}
