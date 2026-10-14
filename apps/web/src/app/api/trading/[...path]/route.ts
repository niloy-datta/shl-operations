import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

type Context = { params: Promise<{ path: string[] }> };
const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const allowed = {
  GET: [new RegExp("^rfqs$"), new RegExp("^rfqs/stats$"),
    new RegExp("^rfqs/" + uuid + "$"), new RegExp("^rfqs/" + uuid + "/offers$"),
    new RegExp("^rfqs/" + uuid + "/history$"),
    new RegExp("^rfqs/" + uuid + "/items$")],
  POST: [new RegExp("^rfqs$"), new RegExp("^rfqs/" + uuid + "/offers$"),
    new RegExp("^rfqs/" + uuid + "/items$")],
  PATCH: [new RegExp("^rfqs/" + uuid + "/status$")],
  PUT: [new RegExp("^rfqs/" + uuid + "/items/" + uuid + "$")],
  DELETE: [new RegExp("^rfqs/" + uuid + "/items/" + uuid + "$")]
} as const;

async function relay(request: Request, context: Context) {
  const { path } = await context.params;
  const target = path.join("/");
  const method = request.method as keyof typeof allowed;
  if (!(method in allowed) || !allowed[method].some(regex => regex.test(target)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (method !== "GET" && !sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const authorization = await sessionAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inputUrl = new URL(request.url);
  const params = new URLSearchParams();
  for (const name of ["q", "page", "size"]) {
    const v = inputUrl.searchParams.get(name);
    if (v !== null) params.set(name, v.slice(0, 120));
  }
  try {
    const body = method === "GET" ? undefined : await request.text();
    if (body && body.length > 16_384)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const apiUrl = process.env.API_INTERNAL_URL + "/api/" + target +
      (params.size ? "?" + params.toString() : "");
    const upstream = await fetch(apiUrl, {
      method, headers: { authorization, "content-type": "application/json" }, body, cache: "no-store"
    });
    if (upstream.status === 204) return new NextResponse(null, {
      status: 204, headers: { "cache-control": "no-store" }
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
export const GET = relay;
export const POST = relay;
export const PATCH = relay;
export const PUT = relay;
export const DELETE = relay;
