"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  createdAt: string;
};
type ContactPage = { content: Contact[]; totalElements: number; totalPages: number };
type Totals = { customers: number; suppliers: number };
type View = "overview" | "customers" | "suppliers";
type IconName = "grid" | "users" | "building" | "arrow" | "plus" | "search" | "refresh" |
  "logout" | "edit" | "download" | "check" | "lock" | "layers" | "package" | "ship" | "chart" | "close";
const emptyPage: ContactPage = { content: [], totalElements: 0, totalPages: 0 };
const primaryViews: { key: View; label: string; icon: IconName }[] = [
  { key: "overview", label: "Overview", icon: "grid" },
  { key: "customers", label: "Customers", icon: "users" },
  { key: "suppliers", label: "Suppliers", icon: "building" }
];
const futureViews: { label: string; icon: IconName }[] = [
  { label: "Sales & RFQs", icon: "layers" },
  { label: "Procurement", icon: "package" },
  { label: "Shipments", icon: "ship" },
  { label: "Finance", icon: "chart" }
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "grid": return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" /></svg>;
    case "building": return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3" /></svg>;
    case "arrow": return <svg {...common}><path d="M4 12h16m-7-7 7 7-7 7" /></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "search": return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
    case "refresh": return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.9 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.1-2" /></svg>;
    case "logout": return <svg {...common}><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9" /></svg>;
    case "edit": return <svg {...common}><path d="m15 5 4 4M4 20l4.5-1 11-11a2.83 2.83 0 0 0-4-4l-11 11L4 20Z" /></svg>;
    case "download": return <svg {...common}><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></svg>;
    case "check": return <svg {...common}><path d="m5 12 5 5L20 7" /></svg>;
    case "lock": return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case "layers": return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5" /></svg>;
    case "package": return <svg {...common}><path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5" /></svg>;
    case "ship": return <svg {...common}><path d="M4 16 2 18c2 0 3 2 5 2s3-2 5-2 3 2 5 2 3-2 5-2l-2-2-8-3-8 3ZM12 13V3m-5 7V6h10v4" /></svg>;
    case "chart": return <svg {...common}><path d="M4 20V4M4 20h16M8 16v-5m5 5V7m5 9v-9" /></svg>;
    case "close": return <svg {...common}><path d="M5 5 19 19M19 5 5 19" /></svg>;
  }
}

export function Workspace() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [data, setData] = useState<ContactPage>(emptyPage);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const requestCounter = useRef(0);

  const load = useCallback(async () => {
    const requestNumber = ++requestCounter.current;
    setLoading(true);
    setError("");
    try {
      const [dashboardResponse, listResponse] = await Promise.all([
        fetch("/api/data/dashboard", { cache: "no-store" }),
        view === "overview" ? Promise.resolve(null) :
          fetch("/api/data/" + view + "?page=" + page + "&size=10&q=" + encodeURIComponent(search), { cache: "no-store" })
      ]);
      if (requestNumber !== requestCounter.current) return;
      if (dashboardResponse.status === 401 || listResponse?.status === 401) {
        router.replace("/login");
        return;
      }
      if (!dashboardResponse.ok || (listResponse && !listResponse.ok)) throw new Error("Unable to load workspace data. Please try again.");
      const counts: Totals = await dashboardResponse.json();
      const records: ContactPage | null = listResponse ? await listResponse.json() : null;
      if (requestNumber !== requestCounter.current) return;
      setTotals(counts);
      if (records) setData(records);
    } catch (caught) {
      if (requestNumber === requestCounter.current) setError(caught instanceof Error ? caught.message : "Unable to load records.");
    } finally {
      if (requestNumber === requestCounter.current) setLoading(false);
    }
  }, [page, router, search, view]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => { window.cancelAnimationFrame(frame); requestCounter.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!formOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setFormOpen(false); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [formOpen, saving]);

  function navigate(target: View) {
    setView(target);
    setPage(0);
    setQuery("");
    setSearch("");
    setFormOpen(false);
    setData(emptyPage);
  }
  function openCreate() { setEditing(null); setFormError(""); setFormOpen(true); }
  function openEdit(contact: Contact) { setEditing(contact); setFormError(""); setFormOpen(true); }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view === "overview") return;
    setSaving(true);
    setFormError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["name", "email", "phone", "country"].map(key =>
      [key, String(form.get(key) || "").trim()]));
    try {
      const url = "/api/data/" + view + (editing ? "/" + encodeURIComponent(editing.id) : "");
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(response.status === 400 ? "Please check your details and try again." : "Unable to save this record.");
      setFormOpen(false);
      setEditing(null);
      if (!editing && page !== 0) setPage(0);
      else void load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  function exportPage() {
    if (view === "overview" || data.content.length === 0) return;
    const fields = ["name", "email", "phone", "country", "createdAt"] as const;
    const escape = (value: string) => {
      // Neutralize spreadsheet formulas in user-controlled contact fields.
      const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const rows = [fields.join(","), ...data.content.map(contact => fields.map(field => escape(contact[field] ?? "")).join(","))];
    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "shl-" + view + "-page-" + (page + 1) + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const title = view === "overview" ? "Overview" : view === "customers" ? "Customers" : "Suppliers";
  const totalRelationships = (totals?.customers ?? 0) + (totals?.suppliers ?? 0);
  const directoryTotal = view === "customers" ? totals?.customers : totals?.suppliers;

  return <div className="shell">
    <aside className="sidebar" aria-label="Workspace sidebar">
      <div className="brand-row"><div className="brand-emblem" aria-hidden="true">S</div>
        <div><div className="brand-mark">SHL<span>.</span></div><div className="brand-description">INTERNATIONAL</div></div></div>
      <div className="workspace-pill"><span className="pill-dot" /> OPERATIONS OS <span className="pill-separator">/</span> INTERNAL</div>
      <nav aria-label="Main navigation">
        <p className="nav-heading">WORKSPACE</p>
        {primaryViews.map(item => <button key={item.key} type="button" aria-current={view === item.key ? "page" : undefined}
          className={["nav-item", view === item.key ? "selected" : ""].join(" ")} onClick={() => navigate(item.key)}>
          <Icon name={item.icon} /><span>{item.label}</span>{view === item.key && <span className="active-indicator" />}</button>)}
        <p className="nav-heading future-heading">COMING NEXT</p>
        {futureViews.map(item => <div key={item.label} className="nav-item nav-planned" title="Planned for a future release">
          <Icon name={item.icon} /><span>{item.label}</span><small>SOON</small></div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="side-status"><Icon name="lock" size={15} /><span>Private operations workspace</span></div>
        <div className="account-row"><div className="user-avatar">A</div><div className="account-info"><strong>Administrator</strong><small>SHL workspace</small></div>
          <button className="icon-button signout" type="button" aria-label="Sign out" title="Sign out" onClick={() => void logout()}><Icon name="logout" /></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">SHL Operations <span>/</span> <strong>{title}</strong></div>
        <div className="topbar-end"><span className="topbar-tag"><span className="status-dot" /> Internal workspace</span><div className="topbar-avatar">A</div></div></header>
      <div className="content">
        {view === "overview" ? <>
          <section className="welcome-hero">
            <div className="hero-content"><p className="hero-kicker"><span className="hero-kicker-line" /> SHL INTERNATIONAL · OPERATIONS CONTROL</p>
              <h1>One workspace.<br /><span>Every connection.</span></h1>
              <p>Bring customers, suppliers, and future trade workflows together in one focused operations hub.</p>
              <div className="hero-buttons"><button className="hero-button" onClick={() => navigate("customers")}>Explore customers <Icon name="arrow" size={16} /></button>
                <button className="hero-link" onClick={() => navigate("suppliers")}>View suppliers <Icon name="arrow" size={15} /></button></div>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="hero-ring ring-one" /><div className="hero-ring ring-two" /><div className="hero-ring ring-three" />
              <div className="hero-art-core"><span>SHL</span><small>GLOBAL OPERATIONS</small></div>
              <div className="hero-node node-one" /><div className="hero-node node-two" /><div className="hero-node node-three" /></div>
          </section>
          <div className="section-head"><div><p className="section-overline">LIVE DATABASE</p><h2>At a glance</h2></div>
            <button className="subtle-button" disabled={loading} onClick={() => void load()}><Icon name="refresh" size={15} /> Refresh</button></div>
          <div className="metric-grid">
            <Metric label="Total relationships" value={totals ? totalRelationships : null} icon="layers" detail="Customers + suppliers" loading={loading} />
            <Metric label="Customers" value={totals?.customers ?? null} icon="users" detail="In your customer directory" loading={loading} />
            <Metric label="Suppliers" value={totals?.suppliers ?? null} icon="building" detail="In your supplier directory" loading={loading} />
          </div>
          {error && <ErrorNotice message={error} retry={() => void load()} />}
          <div className="overview-columns">
            <section className="surface mix-panel"><div className="surface-top"><div><p className="section-overline">RELATIONSHIP MIX</p><h2>Network composition</h2></div><span className="quiet-tag">LIVE TOTALS</span></div>
              <div className="composition-row"><div className="composition-symbol"><Icon name="users" size={21} /></div>
                <div className="composition-info"><div><strong>Customers</strong><span>{totals ? totals.customers.toLocaleString() : "—"}</span></div>
                  <div className="progress-track"><span style={{ width: totalRelationships ? (100 * (totals?.customers ?? 0) / totalRelationships) + "%" : "0%" }} /></div></div></div>
              <div className="composition-row"><div className="composition-symbol supplier-symbol"><Icon name="building" size={21} /></div>
                <div className="composition-info"><div><strong>Suppliers</strong><span>{totals ? totals.suppliers.toLocaleString() : "—"}</span></div>
                  <div className="progress-track supplier-progress"><span style={{ width: totalRelationships ? (100 * (totals?.suppliers ?? 0) / totalRelationships) + "%" : "0%" }} /></div></div></div>
              <p className="surface-note">{totalRelationships === 0 ? "Your network is ready for its first record." : "Calculated from saved customer and supplier records."}</p>
            </section>
            <section className="surface quick-panel"><div className="surface-top"><div><p className="section-overline">QUICK ACTIONS</p><h2>Keep work moving</h2></div></div>
              <button className="quick-action" onClick={() => navigate("customers")}><div className="quick-icon"><Icon name="users" /></div><div><strong>Customer directory</strong><small>Search and manage customer records</small></div><Icon name="arrow" size={17} /></button>
              <button className="quick-action" onClick={() => navigate("suppliers")}><div className="quick-icon teal"><Icon name="building" /></div><div><strong>Supplier directory</strong><small>Maintain your trading network</small></div><Icon name="arrow" size={17} /></button>
            </section>
          </div>
          <div className="footnote"><Icon name="check" size={15} /> Figures are sourced from the application database. No sample metrics are displayed.</div>
        </> : <>
          <div className="page-heading"><div><p className="section-overline">RELATIONSHIP MANAGEMENT <span>/</span> {title.toUpperCase()}</p>
            <h1>{title}<span className="heading-period">.</span></h1>
            <p className="muted">Keep every {view === "customers" ? "customer" : "supplier"} relationship organized and accessible.</p></div>
            <button className="primary" onClick={openCreate}><Icon name="plus" size={17} /> Add {view === "customers" ? "customer" : "supplier"}</button></div>
          <div className="directory-stats"><div className="directory-icon"><Icon name={view === "customers" ? "users" : "building"} size={23} /></div>
            <div><p className="section-overline">DIRECTORY TOTAL</p><strong>{directoryTotal === undefined || directoryTotal === null ? "—" : directoryTotal.toLocaleString()}</strong></div>
            <span className="directory-tip">Saved records</span></div>
          {error && <ErrorNotice message={error} retry={() => void load()} />}
          <section className="surface directory-panel" aria-label={title + " directory"}>
            <div className="table-toolbar"><div><h2>{title} directory</h2><p className="muted">{loading ? "Loading records…" : data.totalElements.toLocaleString() + " matching records"}</p></div>
              <div className="toolbar-actions">
                <form className="search-form" onSubmit={event => { event.preventDefault(); if (search === query && page === 0) void load(); else { setPage(0); setSearch(query); } }}>
                  <Icon name="search" size={17} /><input aria-label={"Search " + title.toLowerCase()} placeholder="Search by name" value={query} onChange={event => setQuery(event.target.value)} />
                  <button type="submit">Search</button></form>
                <button className="outline-icon" aria-label="Refresh records" title="Refresh records" disabled={loading} onClick={() => void load()}><Icon name="refresh" size={17} /></button>
                <button className="outline-icon" aria-label="Export current page to CSV" title="Export current page to CSV" disabled={loading || data.content.length === 0} onClick={exportPage}><Icon name="download" size={17} /></button>
              </div></div>
            <div className="table-wrap" aria-busy={loading}><table><thead><tr><th>NAME</th><th>EMAIL</th><th>PHONE</th><th>COUNTRY</th><th>ADDED</th><th>ACTION</th></tr></thead>
              <tbody>{!loading && data.content.map(item => <tr key={item.id}><td><div className="person"><span className="initial">{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong></div></td>
                <td>{item.email ? <a className="data-link" href={"mailto:" + item.email}>{item.email}</a> : "—"}</td>
                <td>{item.phone || "—"}</td><td>{item.country || "—"}</td>
                <td>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td><button className="edit-button" onClick={() => openEdit(item)}><Icon name="edit" size={14} /> Edit</button></td></tr>)}</tbody></table>
              {loading && <div className="table-state" role="status"><span className="loading-spinner" /> Loading records…</div>}
              {!loading && !error && data.content.length === 0 && <div className="empty"><div className="empty-illustration"><Icon name={view === "customers" ? "users" : "building"} size={30} /></div>
                <h3>{search ? "No matching records" : "Your directory starts here"}</h3>
                <p>{search ? "Try another name or clear your search." : "Add your first " + (view === "customers" ? "customer" : "supplier") + " to begin building your network."}</p>
                {!search && <button className="primary" onClick={openCreate}><Icon name="plus" size={16} /> Add first record</button>}</div>}</div>
            <div className="pagination"><span>Page {page + 1} of {Math.max(1, data.totalPages)}</span><div className="pager-buttons">
              <button disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))}>Previous</button>
              <button disabled={page + 1 >= data.totalPages || loading} onClick={() => setPage(current => current + 1)}>Next</button></div></div>
          </section>
          <p className="directory-footnote">CSV exports include the visible page only. Changes are saved through the private SHL API.</p>
        </>}
      </div>
    </main>

    {formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="modal-head"><div><p className="section-overline">{editing ? "UPDATE RECORD" : "NEW RELATIONSHIP"}</p><h2 id="form-title">{editing ? "Edit" : "Add"} {view === "customers" ? "customer" : "supplier"}</h2>
          <p className="muted">Keep your contact information up to date.</p></div>
          <button className="close" type="button" disabled={saving} onClick={() => setFormOpen(false)} aria-label="Close dialog"><Icon name="close" /></button></div>
        <form key={editing?.id ?? "new"} onSubmit={saveContact} className="stack">
          <label>Name *<input name="name" required maxLength={160} autoFocus defaultValue={editing?.name ?? ""} placeholder="Company or contact name" /></label>
          <label>Email<input name="email" type="email" maxLength={254} defaultValue={editing?.email ?? ""} placeholder="name@company.com" /></label>
          <label>Phone<input name="phone" maxLength={60} defaultValue={editing?.phone ?? ""} placeholder="+1 555 000 0000" /></label>
          <label>Country<input name="country" maxLength={100} defaultValue={editing?.country ?? ""} placeholder="Country" /></label>
          {formError && <p className="notice error" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="secondary" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create record"} <Icon name="arrow" size={15} /></button></div>
        </form>
      </section></div>}
  </div>;
}

function Metric({ label, value, icon, detail, loading }: { label: string; value: number | null; icon: IconName; detail: string; loading: boolean }) {
  return <article className="metric"><div className="metric-head"><span>{label}</span><span className="metric-icon"><Icon name={icon} size={20} /></span></div>
    <strong aria-live="polite">{loading || value === null ? "—" : value.toLocaleString()}</strong>
    <div className="metric-footer"><span className="metric-foot-dot" /> {detail}</div></article>;
}
function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return <div className="notice error" role="alert">{message}<button onClick={retry}>Retry</button></div>;
}
