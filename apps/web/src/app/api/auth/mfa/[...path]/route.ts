import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

type Context = { params: Promise<{ path: string[] }> };
async function relay(request: Request, context: Context) {
  const { path } = await context.params;
  const resource = path.join("/");
  const allowed = request.method === "GET" ? resource === "status" :
    request.method === "POST" && ["enroll", "confirm", "disable"].includes(resource);
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.method !== "GET" && !sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const authorization = await sessionAuthorization();
  if (!authorization)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = request.method === "GET" ? undefined : await request.text();
    if (body && body.length > 4096)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/auth/mfa/${resource}`, {
      method: request.method,
      headers: { authorization, "content-type": "application/json" },
      body,cache: "no-store",signal:AbortSignal.timeout(10_000)
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status, headers: {
        "content-type": "application/json", "cache-control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
export const GET = relay;
export const POST = relay;
