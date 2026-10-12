import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

type Context = { params: Promise<{ resource: string; id: string }> };
const validResources = new Set(["customers", "suppliers"]);
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function PUT(request: Request, context: Context) {
  const { resource, id } = await context.params;
  if (!validResources.has(resource) || !uuidPattern.test(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  const authorization = await sessionAuthorization();
  if (!authorization)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = await request.text();
    if (payload.length > 16_384)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const upstream = await fetch(process.env.API_INTERNAL_URL + "/api/" + resource + "/" + id, {
      method: "PUT",
      headers: { authorization, "content-type": "application/json" },
      body: payload,
      cache: "no-store"
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
