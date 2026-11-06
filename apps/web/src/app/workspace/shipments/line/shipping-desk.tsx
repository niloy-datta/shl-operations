"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspaceIdentity } from "@/components/workspace-identity";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { expireWorkspaceSession } from "@/lib/session-client";
import { LineShipmentPanel } from "../../enterprise/line-quotes/line-shipment-panel";

type Purchase = { id: string; reference: string; status: string; supplier_name: string };
export function LineShippingDesk() {
  const { staff } = useWorkspaceIdentity();
  const params = useSearchParams();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [chosen, setChosen] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canRead = !!staff && ["ADMIN", "MANAGEMENT", "LOGISTICS", "SOURCING"].includes(staff.role);
  const canBook = !!staff && ["ADMIN", "MANAGEMENT", "LOGISTICS"].includes(staff.role);
  const load = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const response = await fetch("/api/enterprise/logistics/line-shipments/eligible-purchase-orders?" +
        new URLSearchParams({ q: search, size: "100" }), { cache: "no-store" });
      if (response.status === 401) { expireWorkspaceSession(); return; }
      if (!response.ok) throw new Error("Eligible purchase orders are unavailable. Please retry.");
      const data = await response.json() as { content: Purchase[] };
      setPurchases(data.content); setChosen(""); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Booking choices unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!canBook) return;
    const frame = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  }, [canBook, load]);
  const shipmentId = params.get("shipmentId") || "";
  return <div className="en-app">
    <aside className="en-sidebar"><Link href="/workspace" className="en-brand">SHL Operations</Link>
      <div className="en-nav-scroll"><WorkspaceNavigation /></div></aside>
    <main className="en-content" style={{ flex: 1, minWidth: 0 }}>
      <div className="en-heading"><div><h1>Shipment workspace</h1>
        <p>Book issued supplier orders, track milestones and review shipping exceptions.</p></div>
        <Link href="/workspace/enterprise/shipments">Earlier shipment records →</Link></div>
      {!staff ? <p role="status">Checking shipping permissions…</p> : !canRead ?
        <p role="alert">Your role cannot access shipping records.</p> : <>
        {canBook && <section className="en-panel en-form">
          <h2>Choose an issued purchase order</h2>
          <p>Only approved, unbooked supplier orders appear. Prices and quotation margins are not exposed.</p>
          <form onSubmit={event => { event.preventDefault(); void load(query); }}>
            <label className="en-field">Search purchase order or supplier
              <input value={query} onChange={event => setQuery(event.target.value)} maxLength={100} /></label>
            <button type="submit" disabled={loading}>Search issued orders</button>
          </form>
          {error && <p role="alert">{error}</p>}
          <label className="en-field">Issued purchase order
            <select value={chosen} disabled={loading} onChange={event => setChosen(event.target.value)}>
              <option value="">{loading ? "Loading eligible orders…" : "Select an order to book"}</option>
              {purchases.map(purchase => <option key={purchase.id} value={purchase.id}>{purchase.reference} · {purchase.supplier_name}</option>)}
            </select></label>
          {!loading && !error && purchases.length === 0 && <p>No eligible orders match this search.</p>}
        </section>}
        <LineShipmentPanel me={staff} purchaseOrders={purchases.filter(purchase => purchase.id === chosen)}
          onBooked={()=>void load(query)}
          initialShipmentId={/^[0-9a-f-]{36}$/i.test(shipmentId) ? shipmentId : undefined} />
      </>}
    </main>
  </div>;
}
