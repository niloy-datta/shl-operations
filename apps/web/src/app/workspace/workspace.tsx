"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Contact = { id: string; name: string; email: string | null; phone: string | null; country: string | null; createdAt: string };
type Page = { content: Contact[]; totalElements: number; totalPages: number };
type View = "overview" | "customers" | "suppliers";
const empty: Page = { content: [], totalElements: 0, totalPages: 0 };

export function Workspace() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [counts, setCounts] = useState({ customers: 0, suppliers: 0 });
  const [data, setData] = useState<Page>(empty);
  const [page, setPage] = useState(0); const [query, setQuery] = useState("");
  const [search, setSearch] = useState(""); const [error, setError] = useState("");
  const [loading, setLoading] = useState(true); const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [dashboard, list] = await Promise.all([
        fetch("/api/data/dashboard", { cache: "no-store" }),
        view === "overview" ? Promise.resolve(null) : fetch(`/api/data/${view}?page=${page}&size=10&q=${encodeURIComponent(search)}`, { cache: "no-store" })
      ]);
      if (dashboard.status === 401 || list?.status === 401) { router.replace("/login"); return; }
      if (!dashboard.ok || (list && !list.ok)) throw new Error("Could not load records");
      setCounts(await dashboard.json()); if (list) setData(await list.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setLoading(false); }
  }, [view, page, search, router]);
  useEffect(() => { void load(); }, [load]);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["name", "email", "phone", "country"].map(k => [k, String(form.get(k) || "").trim()]));
    try {
      const response = await fetch(`/api/data/${view}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(response.status === 400 ? "Check the fields and try again" : "Could not save the record");
      setFormOpen(false); setPage(0); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh();
  }
  const title = view === "overview" ? "Overview" : view === "customers" ? "Customers" : "Suppliers";
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand-mark">SHL<span>.</span></div>
      <div className="workspace-label">OPERATIONS OS <span>INTERNAL</span></div>
      <p className="nav-heading">WORKSPACE</p>
      {(["overview", "customers", "suppliers"] as View[]).map((item, i) =>
        <button key={item} className={`nav-item ${view === item ? "selected" : ""}`} onClick={() => { setView(item); setPage(0); setQuery(""); setSearch(""); setFormOpen(false); }}>
          <span className="nav-icon">{["▦", "♙", "◇"][i]}</span>{item[0].toUpperCase() + item.slice(1)}
        </button>)}
      <div className="sidebar-bottom"><div className="user-avatar">A</div><div><strong>Administrator</strong><small>SHL workspace</small></div>
        <button aria-label="Sign out" title="Sign out" className="logout" onClick={logout}>↗</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><span>Workspace <b>/</b> {title}</span><span className="top-right"><span className="live-dot" /> Internal system</span></header>
      <div className="content"><div className="page-heading"><div><p className="eyebrow">SHL INTERNATIONAL · OPERATIONS</p><h1>{title}</h1>
        <p className="muted">{view === "overview" ? "Your operations, in one place." : `Manage your ${title.toLowerCase()} records.`}</p></div>
        {view !== "overview" && <button className="primary" onClick={() => setFormOpen(true)}>+ Add {view === "customers" ? "customer" : "supplier"}</button>}
      </div>
      {error && <div className="notice error" role="alert">{error} <button onClick={() => void load()}>Retry</button></div>}
      {view === "overview" ? <>
        <div className="metric-grid"><Metric label="CUSTOMERS" value={counts.customers} icon="♙" detail="Records in your CRM" loading={loading} />
          <Metric label="SUPPLIERS" value={counts.suppliers} icon="◇" detail="Trading partners" loading={loading} /></div>
        <section className="panel next-panel"><div className="panel-icon">↗</div><div><p className="eyebrow">GET STARTED</p><h2>Build your network</h2>
          <p className="muted">Add customers and suppliers to start organizing SHL relationships. More workflows will appear here as they are built.</p>
          <button className="text-button" onClick={() => setView("customers")}>View customers →</button></div></section>
      </> : <section className="panel table-panel">
        <div className="table-toolbar"><div><h2>{title} directory</h2><p className="muted">{loading ? "Loading…" : `${data.totalElements} total records`}</p></div>
          <form onSubmit={e => { e.preventDefault(); setPage(0); setSearch(query); }} className="search-form">
            <input aria-label={`Search ${title.toLowerCase()}`} placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)} />
            <button type="submit">Search</button></form></div>
        <div className="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>PHONE</th><th>COUNTRY</th><th>ADDED</th></tr></thead>
          <tbody>{data.content.map(item => <tr key={item.id}><td className="person"><span className="initial">{item.name.slice(0, 1).toUpperCase()}</span>{item.name}</td>
            <td>{item.email || "—"}</td><td>{item.phone || "—"}</td><td>{item.country || "—"}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
          {!loading && data.content.length === 0 && <div className="empty"><div className="empty-icon">◇</div><h3>No {title.toLowerCase()} found</h3>
            <p>{search ? "Try a different search." : `Add your first ${view === "customers" ? "customer" : "supplier"} to get started.`}</p></div>}</div>
        <div className="pagination"><span>Page {page + 1} of {Math.max(1, data.totalPages)}</span><div>
          <button disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous</button>
          <button disabled={page + 1 >= data.totalPages || loading} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </section>}
      </div>
    </main>
    {formOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setFormOpen(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-head"><div><p className="eyebrow">NEW RECORD</p>
        <h2 id="form-title">Add {view === "customers" ? "customer" : "supplier"}</h2></div><button className="close" onClick={() => setFormOpen(false)} aria-label="Close">×</button></div>
        <form onSubmit={add} className="stack"><label>Name *<input name="name" maxLength={160} required autoFocus /></label>
          <label>Email<input type="email" name="email" maxLength={254} /></label><label>Phone<input name="phone" maxLength={60} /></label>
          <label>Country<input name="country" maxLength={100} /></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancel</button>
          <button disabled={saving} className="primary">{saving ? "Saving…" : "Save record"}</button></div></form></section></div>}
  </div>;
}
function Metric({ label, value, icon, detail, loading }: { label: string; value: number; icon: string; detail: string; loading: boolean }) {
  return <div className="metric"><div className="metric-head"><span>{label}</span><span className="metric-icon">{icon}</span></div>
    <strong>{loading ? "—" : value.toLocaleString()}</strong><small>{detail}</small></div>;
}

