"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Contact = { id: string; name: string; country: string | null };
type ContactPage = { content: Contact[] };
type Rfq = {
  id: string; reference: string; customerId: string; customerName: string;
  subject: string; details: string | null; quantity: number; unit: string;
  currency: string; deadline: string | null; status: Stage;
  offerCount: number; createdAt: string;
};
type Stage = "NEW" | "SOURCING" | "READY_FOR_QUOTE" | "CLOSED";
type RfqPage = { content: Rfq[]; totalElements: number; totalPages: number };
type Offer = { id: string; supplierId: string; supplierName: string; unitPrice: number;
  moq: number; leadDays: number; notes: string | null; updatedAt: string };
type Event = { actor: string; action: string; detail: string | null; createdAt: string };
type Stats = { total: number; NEW: number; SOURCING: number; READY_FOR_QUOTE: number; CLOSED: number };
const blankPage: RfqPage = { content: [], totalElements: 0, totalPages: 0 };
const stages: Record<Stage, { label: string; next?: Stage; action?: string }> = {
  NEW: { label: "New inquiry", next: "SOURCING", action: "Start sourcing" },
  SOURCING: { label: "Sourcing", next: "READY_FOR_QUOTE", action: "Mark ready for quote" },
  READY_FOR_QUOTE: { label: "Ready for quote", next: "CLOSED", action: "Close RFQ" },
  CLOSED: { label: "Closed" }
};
async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Session expired.");
  }
  if (!response.ok) {
    if (response.status === 409) throw new Error("Workflow rule blocked this action. Check its status and supplier offers.");
    if (response.status === 400) throw new Error("Please check the required fields and selected records.");
    throw new Error("Request failed (" + response.status + "). Please retry.");
  }
  return response.json() as Promise<T>;
}
const money = (amount: number | string, currency: string) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(amount)) + " " + currency;
const date = (value: string | null) => value ? new Date(value + (value.includes("T") ? "" : "T12:00:00")).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";

export function RfqWorkspace() {
  const [list, setList] = useState<RfqPage>(blankPage);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  const refresh = useCallback(() => setTick(v => v + 1), []);

  useEffect(() => {
    let live = true;
    const frame = requestAnimationFrame(() => setLoading(true));
    Promise.all([
      json<RfqPage>("/api/trading/rfqs?page=" + page + "&size=10&q=" + encodeURIComponent(term)),
      json<Stats>("/api/trading/rfqs/stats")
    ]).then(([records, totals]) => {
      if (!live) return;
      setList(records); setStats(totals); setMessage("");
    }).catch(e => { if (live) setMessage(e instanceof Error ? e.message : "Unable to load RFQs"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; cancelAnimationFrame(frame); };
  }, [page, term, tick]);

  useEffect(() => {
    if (!selectedId) return;
    let live = true;
    const frame = requestAnimationFrame(() => setDetailLoading(true));
    Promise.all([
      json<Rfq>("/api/trading/rfqs/" + selectedId),
      json<Offer[]>("/api/trading/rfqs/" + selectedId + "/offers"),
      json<Event[]>("/api/trading/rfqs/" + selectedId + "/history")
    ]).then(([record, quotes, history]) => {
      if (!live) return;
      setSelected(record); setOffers(quotes); setEvents(history);
    }).catch(e => { if (live) setMessage(e instanceof Error ? e.message : "Unable to load details"); })
      .finally(() => { if (live) setDetailLoading(false); });
    return () => { live = false; cancelAnimationFrame(frame); };
  }, [selectedId, tick]);

  useEffect(() => {
    if (!showCreate && !showOffer) return;
    let live = true;
    const timeout = setTimeout(() => {
      Promise.all([
        json<ContactPage>("/api/data/customers?size=100&q=" + encodeURIComponent(customerSearch)),
        json<ContactPage>("/api/data/suppliers?size=100&q=" + encodeURIComponent(supplierSearch))
      ]).then(([c, s]) => { if (live) { setCustomers(c.content); setSuppliers(s.content); } })
        .catch(e => { if (live) setMessage(e instanceof Error ? e.message : "Unable to load company directory"); });
    }, 260);
    return () => { live = false; clearTimeout(timeout); };
  }, [showCreate, showOffer, customerSearch, supplierSearch]);

  async function createRfq(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setMessage("");
    const data = new FormData(e.currentTarget);
    const payload = {
      customerId: String(data.get("customerId") || ""),
      subject: String(data.get("subject") || "").trim(),
      details: String(data.get("details") || "").trim(),
      quantity: String(data.get("quantity") || ""),
      unit: String(data.get("unit") || "").trim(),
      currency: String(data.get("currency") || "").trim().toUpperCase(),
      deadline: String(data.get("deadline") || "") || null
    };
    try {
      const created = await json<Rfq>("/api/trading/rfqs", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
      });
      setShowCreate(false); setSelectedId(created.id); setPage(0); refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not create RFQ"); }
    finally { setSaving(false); }
  }

  async function saveOffer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true); setMessage("");
    const data = new FormData(e.currentTarget);
    const payload = {
      supplierId: String(data.get("supplierId") || ""),
      unitPrice: String(data.get("unitPrice") || ""),
      moq: String(data.get("moq") || ""),
      leadDays: Number(data.get("leadDays")),
      notes: String(data.get("notes") || "").trim()
    };
    try {
      await json<Offer[]>("/api/trading/rfqs/" + selectedId + "/offers", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
      });
      setShowOffer(false); refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not save supplier offer"); }
    finally { setSaving(false); }
  }

  async function moveStage() {
    if (!selectedId || !selected || !stages[selected.status].next) return;
    setSaving(true); setMessage("");
    try {
      await json<Rfq>("/api/trading/rfqs/" + selectedId + "/status", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: stages[selected.status].next })
      });
      refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not update status"); }
    finally { setSaving(false); }
  }

  return <div className="desk">
    <aside className="desk-side">
      <Link className="desk-brand" href="/workspace" aria-label="SHL Operations home">
        <span className="desk-monogram">S</span><span><strong>SHL<span className="desk-mark">.</span></strong><small>INTERNATIONAL</small></span>
      </Link>
      <div className="desk-edition"><span className="desk-led" /> OPERATIONS OS <em>V1</em></div>
      <p className="desk-side-label">COMMAND CENTER</p>
      <nav aria-label="Business modules" className="desk-nav">
        <Link href="/workspace"><span>▦</span> Overview</Link>
        <div className="desk-active"><span>◫</span> RFQ &amp; Sourcing <i>LIVE</i></div>
        <Link href="/workspace/enterprise/quotes"><span>◈</span> Customer quotations</Link>
        <Link href="/workspace/enterprise/orders"><span>▣</span> Sales orders</Link>
        <Link href="/workspace/enterprise/purchase-orders"><span>⬡</span> Purchase orders</Link>
        <Link href="/workspace/enterprise/shipments"><span>⇢</span> Shipments</Link>
        <Link href="/workspace/enterprise/invoices"><span>▥</span> Finance</Link>
        <Link href="/workspace/enterprise/tasks"><span>☷</span> Team tasks</Link>
        <Link href="/workspace/account"><span>◌</span> My security</Link>
        <Link href="/workspace"><span>♙</span> Customers &amp; Suppliers</Link>
      </nav>
      <p className="desk-side-label desk-planned-title">COMING NEXT</p>
      <div className="desk-nav desk-planned"><div><span>⬡</span> Procurement <i>SOON</i></div>
        <div><span>♧</span> Shipments <i>SOON</i></div><div><span>▥</span> Finance <i>SOON</i></div>
        <div><span>◇</span> Tasks &amp; Teams <i>SOON</i></div></div>
      <div className="desk-side-footer"><span className="desk-lock">◈</span><div><strong>Private workspace</strong><small>Authenticated operations data</small></div></div>
    </aside>
    <main className="desk-main">
      <header className="desk-topbar"><div>SHL Operations <span>/</span> Trading Desk <span>/</span> <strong>RFQs</strong></div>
        <span className="desk-private"><span className="desk-led" /> INTERNAL</span></header>
      <div className="desk-content">
        <div className="desk-heading"><div><p className="desk-eyebrow">GLOBAL COMMERCE / SOURCING PIPELINE</p><h1>Trading Desk<span>.</span></h1>
          <p>From customer requests to supplier comparisons. Every decision in one place.</p></div>
          <button className="desk-primary" onClick={() => { setMessage(""); setShowCreate(true); }}>＋ New RFQ <span>↗</span></button></div>

        <section className="desk-hero"><div className="desk-hero-content"><span className="desk-hero-badge">SHL TRADE INTELLIGENCE</span>
          <h2>One inquiry.<br /><span>Complete visibility.</span></h2>
          <p>Bring your customer requirements and supplier quotations into a structured sourcing workflow.</p>
          <div className="desk-hero-stages"><span>01 · Inquiry</span><b>→</b><span>02 · Sourcing</span><b>→</b><span>03 · Ready to quote</span></div></div>
          <div className="desk-orbit" aria-hidden="true"><div className="desk-orbit-ring a" /><div className="desk-orbit-ring b" /><div className="desk-orbit-ring c" /><div className="desk-orbit-core">SHL<small>GLOBAL</small></div><i className="p1"/><i className="p2"/><i className="p3"/></div>
        </section>

        <div className="desk-section-head"><div><p className="desk-eyebrow">LIVE DATABASE</p><h2>Pipeline overview</h2></div>
          <button className="desk-refresh" onClick={refresh} disabled={loading}>↻ Refresh</button></div>
        <div className="desk-stats">
          <Stat label="Total RFQs" value={stats?.total} tint="blue" icon="▦" />
          <Stat label="New inquiries" value={stats?.NEW} tint="violet" icon="◇" />
          <Stat label="In sourcing" value={stats?.SOURCING} tint="orange" icon="⬡" />
          <Stat label="Ready for quote" value={stats?.READY_FOR_QUOTE} tint="green" icon="↗" />
        </div>
        {message && <div className="desk-alert" role="alert">{message}<button onClick={() => setMessage("")}>Dismiss</button></div>}
        <section className="desk-board">
          <div className="desk-board-top"><div><p className="desk-eyebrow">OPERATIONAL WORKSPACE</p><h2>RFQ pipeline</h2><span>{loading ? "Loading…" : list.totalElements + " matching requests"}</span></div>
            <form className="desk-search" onSubmit={e => { e.preventDefault(); setPage(0); setTerm(query); }}>
              <label className="sr-only" htmlFor="desk-query">Search RFQs</label>
              <input id="desk-query" placeholder="Search RFQ, product, customer…" value={query} onChange={e => setQuery(e.target.value)} />
              <button type="submit">Search</button></form></div>
          <div className="desk-table-wrap"><table><thead><tr><th>REFERENCE</th><th>CUSTOMER / REQUEST</th><th>QUANTITY</th><th>OFFERS</th><th>DEADLINE</th><th>STATUS</th><th /></tr></thead>
            <tbody>{!loading && list.content.map(r => <tr key={r.id}>
              <td><strong className="desk-ref">{r.reference}</strong></td>
              <td><strong>{r.subject}</strong><small>{r.customerName}</small></td>
              <td>{Number(r.quantity).toLocaleString()} {r.unit}</td>
              <td>{r.offerCount}</td>
              <td>{date(r.deadline)}</td>
              <td><Status stage={r.status}/></td>
              <td><button className="desk-open" onClick={() => { setSelected(null); setSelectedId(r.id); }}>Review ↗</button></td>
            </tr>)}</tbody></table>
            {loading && <div className="desk-empty">Loading sourcing records…</div>}
            {!loading && list.content.length === 0 && <div className="desk-empty"><div>◇</div><h3>No RFQs found</h3>
              <p>{term ? "Try another search term." : "Create your first customer inquiry to begin structured sourcing."}</p>
              {!term && <button className="desk-primary" onClick={() => setShowCreate(true)}>＋ Create first RFQ</button>}</div>}</div>
          <footer className="desk-pagination"><span>Page {page + 1} / {Math.max(list.totalPages, 1)}</span><div>
            <button disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
            <button disabled={page + 1 >= list.totalPages || loading} onClick={() => setPage(p => p + 1)}>Next</button></div></footer>
        </section>
        <div className="desk-notice"><span>◇</span> These figures come from saved RFQ records. Connected purchasing, logistics and finance modules are available to authorized staff.</div>
      </div>
    </main>

    {selectedId && <div className="desk-drawer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>
      <section className="desk-drawer" role="dialog" aria-modal="true" aria-label="RFQ details">
        <header><div><p className="desk-eyebrow">SOURCE & COMPARE</p><h2>{selected?.reference ?? "Loading RFQ…"}</h2></div>
          <button className="desk-close" onClick={() => setSelectedId(null)} aria-label="Close RFQ details">×</button></header>
        {detailLoading || !selected ? <div className="desk-empty">Loading details…</div> : <>
          <div className="desk-drawer-body">
            <div className="desk-detail-lead"><Status stage={selected.status}/><h3>{selected.subject}</h3>
              <p>{selected.customerName}</p><p>{selected.details || "No detailed notes yet."}</p></div>
            <div className="desk-detail-grid"><div><small>REQUESTED QUANTITY</small><strong>{Number(selected.quantity).toLocaleString()} {selected.unit}</strong></div>
              <div><small>QUOTE CURRENCY</small><strong>{selected.currency}</strong></div>
              <div><small>DEADLINE</small><strong>{date(selected.deadline)}</strong></div>
              <div><small>SUPPLIER OFFERS</small><strong>{offers.length}</strong></div></div>
            <div className="desk-offer-header"><div><p className="desk-eyebrow">COMPARISON MATRIX</p><h3>Supplier offers</h3></div>
              {selected.status === "SOURCING" && <button onClick={() => { setMessage(""); setShowOffer(true); }}>＋ Add offer</button>}</div>
            {offers.length === 0 ? <p className="desk-panel-empty">No supplier quotations yet. Start sourcing to add offers; accepted offers are frozen when ready for quote.</p> :
              <div className="desk-offers">{offers.map((o, index) => <article className="desk-offer" key={o.id}>
                <div><h4>{o.supplierName}</h4>{index === 0 && <span>LOWEST UNIT PRICE</span>}</div>
                <strong>{money(o.unitPrice, selected.currency)} <small>/ {selected.unit}</small></strong>
                <p>MOQ: {Number(o.moq).toLocaleString()} {selected.unit} <b>·</b> Lead time: {o.leadDays} days</p>
                {o.notes && <p>{o.notes}</p>}
              </article>)}</div>}
            <p className="desk-caution">All offers use the RFQ currency. Unit price alone does not account for freight, taxes, quality, payment terms or MOQ.</p>
            <div className="desk-event-head"><p className="desk-eyebrow">ACCOUNTABILITY</p><h3>Activity log</h3></div>
            <div className="desk-events">{events.map((a, i) => <div key={i}><span>•</span><div><strong>{a.action.replaceAll("_", " ")}</strong><small>{a.detail || ""} · {a.actor} · {new Date(a.createdAt).toLocaleString("en-GB")}</small></div></div>)}</div>
          </div>
          <footer className="desk-drawer-actions">
            {stages[selected.status].next ?
              <button className="desk-primary" disabled={saving} onClick={() => void moveStage()}>{saving ? "Updating…" : stages[selected.status].action} →</button> :
              <p>RFQ closed · Read only</p>}
          </footer>
        </>}
      </section></div>}

    {showCreate && <div className="desk-modal-backdrop"><section className="desk-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <header><div><p className="desk-eyebrow">CUSTOMER INQUIRY</p><h2 id="create-title">Create a new RFQ</h2><p>Capture the request before sourcing suppliers.</p></div>
        <button className="desk-close" onClick={() => setShowCreate(false)} disabled={saving} aria-label="Close">×</button></header>
      <form onSubmit={createRfq} className="desk-form">
        <label>Find customer<input placeholder="Filter customers by name" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} /></label>
        <label>Customer *<select name="customerId" required defaultValue=""><option value="" disabled>Select a saved customer</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.country ? " · " + c.country : ""}</option>)}</select></label>
        <label>Product / inquiry subject *<input name="subject" maxLength={180} required placeholder="e.g. Stainless steel plates" /></label>
        <label>Specifications / scope<textarea name="details" maxLength={4000} rows={3} placeholder="Grade, size, port, packaging, Incoterms and other requirements" /></label>
        <div className="desk-form-grid"><label>Quantity *<input name="quantity" type="number" min="0.001" step="0.001" required placeholder="1000" /></label>
          <label>Unit *<input name="unit" maxLength={32} required placeholder="MT / pcs / kg" /></label></div>
        <div className="desk-form-grid"><label>Currency *<input name="currency" maxLength={3} pattern="[A-Z]{3}" required defaultValue="USD" placeholder="USD" /></label>
          <label>Target deadline<input name="deadline" type="date" /></label></div>
        {message && <p className="desk-inline-error" role="alert">{message}</p>}
        <footer><button type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button><button type="submit" className="desk-primary" disabled={saving}>{saving ? "Creating…" : "Create RFQ →"}</button></footer>
      </form></section></div>}

    {showOffer && selected && <div className="desk-modal-backdrop"><section className="desk-modal" role="dialog" aria-modal="true" aria-labelledby="offer-title">
      <header><div><p className="desk-eyebrow">SUPPLIER SOURCING</p><h2 id="offer-title">Record supplier quotation</h2>
        <p>{selected.reference} · Prices in {selected.currency} per {selected.unit}</p></div>
        <button className="desk-close" onClick={() => setShowOffer(false)} disabled={saving} aria-label="Close">×</button></header>
      <form onSubmit={saveOffer} className="desk-form">
        <label>Find supplier<input placeholder="Filter suppliers by name" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} /></label>
        <label>Supplier *<select name="supplierId" required defaultValue=""><option value="" disabled>Select a saved supplier</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.country ? " · " + s.country : ""}</option>)}</select></label>
        <div className="desk-form-grid"><label>Unit price ({selected.currency}) *<input type="number" name="unitPrice" min="0.0001" step="0.0001" required /></label>
          <label>MOQ ({selected.unit}) *<input type="number" name="moq" min="0.001" step="0.001" required /></label></div>
        <label>Lead time (days) *<input type="number" name="leadDays" min="1" max="3650" step="1" required /></label>
        <label>Quotation notes<textarea name="notes" maxLength={2000} rows={3} placeholder="Freight excluded, supplier terms, QC requirements…" /></label>
        <p className="desk-caution">Saving the same supplier again updates their current offer. Supplier quotations are internal working records, not purchase approvals.</p>
        {message && <p className="desk-inline-error" role="alert">{message}</p>}
        <footer><button type="button" onClick={() => setShowOffer(false)} disabled={saving}>Cancel</button>
          <button className="desk-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save supplier offer →"}</button></footer>
      </form></section></div>}
  </div>;
}
function Status({ stage }: { stage: Stage }) { return <span className={"desk-stage stage-" + stage.toLowerCase()}><i />{stages[stage].label}</span>; }
function Stat({ label, value, tint, icon }: { label: string; value?: number; tint: string; icon: string }) {
  return <article className="desk-stat"><div><span>{label}</span><i className={"desk-stat-icon " + tint}>{icon}</i></div>
    <strong>{value === undefined ? "—" : value.toLocaleString()}</strong><small>Saved records</small></article>;
}
