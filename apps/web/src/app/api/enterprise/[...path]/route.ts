import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";

type Context = { params: Promise<{ path: string[] }> };
const id = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const regex = (pattern: string) => new RegExp("^" + pattern + "$");
const paths: Record<string, RegExp[]> = {
  GET: [
    regex("commerce/(quotes|orders|purchase-orders)(/" + id + ")?"),
    regex("commerce/line-quotes(/" + id + ")?"),
    regex("commerce/line-orders(/" + id + ")?"),
    regex("commerce/line-orders/purchase-orders/" + id),
    regex("logistics/shipments(/" + id + "(/milestones)?)?"),
    regex("logistics/line-shipments(/" + id + ")?"),
    regex("logistics/consignees(/" + id + ")?"),
    regex("entities(/" + id + "(/contacts)?)?"),
    regex("finance/(invoices(/" + id + "(/payments)?)?|summary)"),
    regex("finance/line-billing(/" + id + ")?"),
    regex("finance/line-billing/eligible-orders"),
    regex("dedup/candidates"),
    regex("tasks"), regex("staff"), regex("staff/options"), regex("audit")
  ],
  POST: [
    regex("commerce/(quotes|orders|purchase-orders)"),
    regex("commerce/line-quotes"),
    regex("commerce/line-quotes/" + id + "/(submit|review)"),
    regex("commerce/line-orders"),
    regex("commerce/line-orders/" + id + "/purchase-orders"),
    regex("logistics/shipments"), regex("logistics/consignees"), regex("finance/invoices"),
    regex("finance/line-billing"),
    regex("logistics/line-shipments"),
    regex("entities(/" + id + "/contacts)?"),
    regex("finance/invoices/" + id + "/payments"),
    regex("tasks"), regex("staff"), regex("staff/password")
  ],
  PATCH: [
    regex("commerce/(quotes|orders|purchase-orders)/" + id + "/status"),
    regex("commerce/line-orders/" + id + "/status"),
    regex("commerce/line-orders/purchase-orders/" + id + "/status"),
    regex("logistics/shipments/" + id + "/status"),
    regex("logistics/line-shipments/" + id + "/status"),
    regex("logistics/shipments/" + id + "/consignee"),
    regex("logistics/consignees/" + id),
    regex("entities/" + id + "(/contacts/" + id + ")?"),
    regex("finance/invoices/" + id + "/status"),
    regex("finance/line-billing/" + id + "/review"),
    regex("tasks/" + id + "/status"),
    regex("staff/" + id + "/access")
  ]
};

async function relay(request: Request, context: Context) {
  const { path } = await context.params;
  const target = path.join("/");
  const method = request.method;
  if (!paths[method]?.some(pattern => pattern.test(target)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (method !== "GET" && !sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const authorization = await sessionAuthorization();
  if (!authorization)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const incoming = new URL(request.url);
  const query = new URLSearchParams();
  for (const key of ["page", "size", "q", "customerId", "rfqId", "entity", "salesOrderId"]) {
    const value = incoming.searchParams.get(key);
    if (value !== null) query.set(key, value.slice(0, 120));
  }
  try {
    const body = method === "GET" ? undefined : await request.text();
    if (body && body.length > 16_384)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const upstream = await fetch(
      process.env.API_INTERNAL_URL + "/api/" + target + (query.size ? "?" + query : ""),
      { method, headers: { authorization, "content-type": "application/json" },
        body, cache: "no-store" }
    );
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
