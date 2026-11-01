import { NextResponse } from "next/server";
import { resolveBusinessPath } from "@/lib/api-routing";
import { backendRequest } from "@/lib/backend";
import { sameOrigin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { verifiedIdentity, verifiedUser } from "@/lib/supabase/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };
function failure(status: number, error: string, code: string) { return NextResponse.json({ error, code }, { status, headers: noStore }); }

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path;
  const path = resolveBusinessPath(parts);
  if (!path) return failure(404, "This endpoint is not available.", "NOT_FOUND");
  const mutation = !["GET", "HEAD"].includes(request.method);
  if (mutation && !sameOrigin(request)) return failure(403, "Invalid request origin.", "INVALID_ORIGIN");
  let client;
  try { client = await createClient(); } catch { return failure(503, "Sign-in service is not configured.", "AUTH_UNAVAILABLE"); }
  const user = parts[0] === "auth" ? await verifiedIdentity(client) : await verifiedUser(client);
  if (!user) return failure(401, "Sign in required.", "SIGN_IN_REQUIRED");
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) return failure(401, "Sign in again.", "SESSION_EXPIRED");
  let body: string | undefined;
  if (mutation && request.body) {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure(415, "Send a JSON request.", "JSON_REQUIRED");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 1_048_576) { await reader.cancel(); return failure(413, "The request is too large.", "BODY_TOO_LARGE"); }
        chunks.push(chunk.value);
      }
    } catch { return failure(400, "The request body could not be read.", "INVALID_BODY"); }
    finally { reader.releaseLock(); }
    body = Buffer.concat(chunks).toString("utf8");
    if (body) { try { JSON.parse(body); } catch { return failure(400, "Invalid JSON request.", "INVALID_JSON"); } }
  }
  const query = new URL(request.url).search;
  if (query.length > 8192) return failure(400, "The query is too long.", "INVALID_QUERY");
  try {
    const response = await backendRequest(path + query, data.session.access_token, {
      method: request.method, body, signal: request.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined
    });
    if (response.status >= 300 && response.status < 400) return failure(502, "The data service returned an unexpected redirect.", "INVALID_UPSTREAM");
    if (response.status === 204) return new NextResponse(null, { status: 204, headers: noStore });
    let value: unknown;
    try { value = await response.json(); } catch { return failure(502, "The data service returned an invalid response.", "INVALID_UPSTREAM"); }
    if (response.status === 401) await client.auth.signOut({ scope: "local" });
    return NextResponse.json(value, { status: response.status, headers: noStore });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "BACKEND_NOT_CONFIGURED") return failure(503, "Service not connected yet.", "SERVICE_NOT_CONFIGURED");
    if (caught instanceof Error && caught.name === "TimeoutError") return failure(504, "The data service took too long to respond.", "UPSTREAM_TIMEOUT");
    return failure(502, "The data service could not be reached.", "UPSTREAM_UNAVAILABLE");
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
