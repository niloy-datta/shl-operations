import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

export async function GET(request: Request) {
  const authorization = await sessionAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = new URL(request.url), query = new URLSearchParams();
  for (const key of ["q", "categoryId", "status", "sort", "direction", "page", "size"]) {
    const value = input.searchParams.get(key); if (value !== null) query.set(key, value.slice(0, 160));
  }
  try {
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/products?${query}`, {
      headers: { authorization }, cache: "no-store", signal: AbortSignal.timeout(15_000)
    });
    return new NextResponse(await upstream.text(), { status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const authorization = await sessionAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.text();
    if (body.length > 64_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/products`, { method: "POST",
      headers: { authorization, "content-type": "application/json" }, body, cache: "no-store",
      signal: AbortSignal.timeout(15_000) });
    return new NextResponse(await upstream.text(), { status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
