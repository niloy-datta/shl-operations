import { NextResponse } from "next/server";
import { cookieName, sameOrigin, seal } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  let username: string, password: string;
  try {
    const data = await request.json();
    username = data.username; password = data.password;
    if (typeof username !== "string" || typeof password !== "string" || !username || !password)
      throw new Error("Invalid input");
  } catch { return NextResponse.json({ error: "Username and password required" }, { status: 400 }); }
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  try {
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/me`, {
      headers: { authorization }, cache: "no-store"
    });
    if (!upstream.ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const response = NextResponse.json(await upstream.json());
    response.cookies.set(cookieName, seal(authorization), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60
    });
    return response;
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}

