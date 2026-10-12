import { NextResponse } from "next/server";
import { cookieName, sameOrigin } from "@/lib/session";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}

