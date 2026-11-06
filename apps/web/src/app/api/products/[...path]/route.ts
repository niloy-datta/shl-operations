import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

type Context = { params: Promise<{ path: string[] }> };
const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const routes = {
  GET: [/^$/, /^categories$/, /^manufacturers$/, /^templates$/, /^compare$/, new RegExp("^" + uuid + "$"), new RegExp("^" + uuid + "/(history|quotes)$")],
  POST: [/^$/, /^categories$/, /^manufacturers$/, new RegExp("^" + uuid + "/(approve|archive)$")],
  PUT: [new RegExp("^" + uuid + "$")]
} as const;

async function relay(request: Request, context: Context) {
  const path = (await context.params).path;
  const target = path.join("/");
  const method = request.method as keyof typeof routes;
  if (!(method in routes) || !routes[method].some(pattern => pattern.test(target)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (method !== "GET" && !sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const authorization = await sessionAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = new URL(request.url);
  const query = new URLSearchParams();
  for (const key of ["q", "categoryId", "status", "sort", "direction", "page", "size", "ids"]) {
    const value = input.searchParams.get(key);
    if (value !== null) query.set(key, value.slice(0, 500));
  }
  try {
    const body = method === "GET" ? undefined : await request.text();
    if (body && body.length > 64_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/products${target ? "/" + target : ""}${query.size ? "?" + query : ""}`, {
      method, headers: { authorization, "content-type": "application/json" }, body,
      cache: "no-store", signal: AbortSignal.timeout(15_000)
    });
    if (upstream.status === 204) return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
    return new NextResponse(await upstream.text(), { status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
export const GET = relay;
export const POST = relay;
export const PUT = relay;
