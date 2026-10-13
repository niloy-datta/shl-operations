import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await context.params;
  if (!/^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const authorization = await sessionAuthorization();
  if (!authorization)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const upstream = await fetch(`${process.env.API_INTERNAL_URL}/api/auth/sessions/${id}`, {
      method: "DELETE", headers: { authorization },
      cache: "no-store", signal: AbortSignal.timeout(10_000)
    });
    return new NextResponse(null, {
      status: upstream.status,
      headers: { "cache-control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
