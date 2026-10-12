import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

type Context = { params: Promise<{ resource: string }> };
const resources = new Set(["customers", "suppliers", "dashboard", "me"]);
async function relay(request: Request, context: Context) {
  const { resource } = await context.params;
  if (!resources.has(resource)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.method === "POST" && resource !== "customers" && resource !== "suppliers")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.method !== "GET" && !sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const authorization = await sessionAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const params = new URLSearchParams();
  for (const name of ["q", "page", "size"]) {
    const value = url.searchParams.get(name);
    if (value !== null) params.set(name, value.slice(0, 160));
  }
  try {
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/${resource}?${params}`, {
      method: request.method, headers: { authorization, "content-type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store"
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status, headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
export const GET = relay;
export const POST = relay;

