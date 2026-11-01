"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isContactPage, isTotals, readService, RequestError, type Contact, type ContactPage, type ServiceIssue, type Totals } from "@/lib/frontend-service";

type View = "overview" | "customers" | "suppliers";
type IconName = "grid" | "users" | "building" | "arrow" | "plus" | "search" | "refresh" |
  "logout" | "edit" | "download" | "check" | "lock" | "layers" | "package" | "ship" | "chart" | "close";
const primaryViews: { key: View; label: string; icon: IconName }[] = [
  { key: "overview", label: "Overview", icon: "grid" },
  { key: "customers", label: "Customers", icon: "users" },
  { key: "suppliers", label: "Suppliers", icon: "building" }
];
const enterpriseViews: { label: string; href: string; icon: IconName }[] = [
  { label: "Executive cockpit", href: "/workspace/command-center", icon: "chart" },
  { label: "Due dates & alerts", href: "/workspace/alerts", icon: "check" },
  { label: "Lead pipeline", href: "/workspace/growth/leads", icon: "users" },
  { label: "Projects & jobs", href: "/workspace/growth/projects", icon: "grid" },
  { label: "Quotations", href: "/workspace/enterprise/quotes", icon: "layers" },
  { label: "Sales orders", href: "/workspace/enterprise/orders", icon: "grid" },
  { label: "Purchase orders", href: "/workspace/enterprise/purchase-orders", icon: "package" },
  { label: "Shipments", href: "/workspace/enterprise/shipments", icon: "ship" },
  { label: "Consignees", href: "/workspace/consignees", icon: "users" },
  { label: "Global entities", href: "/workspace/entities", icon: "building" },
  { label: "Finance", href: "/workspace/enterprise/invoices", icon: "chart" },
  { label: "Line billing review", href: "/workspace/finance/line-billing", icon: "chart" },
  { label: "Expenses", href: "/workspace/costs/expenses", icon: "chart" },
  { label: "Project contribution", href: "/workspace/costs/profitability", icon: "chart" },
  { label: "Team tasks", href: "/workspace/enterprise/tasks", icon: "check" },
  { label: "Staff & audit", href: "/workspace/enterprise/staff", icon: "users" }
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
  useEffect(() => {
    const queryView = new URLSearchParams(window.location.search).get("view");
    if (queryView !== "customers" && queryView !== "suppliers") return;
    const frame = window.requestAnimationFrame(() => setView(queryView));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [data, setData] = useState<ContactPage | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [dashboardError, setDashboardError] = useState<ServiceIssue | null>(null);
  const [directoryError, setDirectoryError] = useState<ServiceIssue | null>(null);
  const [writeError, setWriteError] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const saveController = useRef<AbortController | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [commissionAccess, setCommissionAccess] = useState(false);
  const [commissionIssue, setCommissionIssue] = useState<ServiceIssue | null>(null);
  const [commissionRevision, setCommissionRevision] = useState(0);
  const [staff, setStaff] = useState<{ username: string; role: string } | null>(null);
  const [staffIssue, setStaffIssue] = useState<ServiceIssue | null>(null);
  const [staffRevision, setStaffRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStaff(null); setStaffIssue(null);
    readService("/api/data/me", controller.signal,
      (value): value is { username: string; role: string } => !!value && typeof value === "object" &&
        typeof (value as { username?: unknown }).username === "string" && typeof (value as { role?: unknown }).role === "string")
      .then(value => { if (!controller.signal.aborted) setStaff(value); })
      .catch(caught => {
        if (controller.signal.aborted) return;
        const issue = caught instanceof RequestError ? caught.issue : { title: "Access check unavailable", message: "Staff permissions could not be verified." };
        if (issue.unauthorized) router.replace("/login"); else setStaffIssue(issue);
      });
    return () => controller.abort();
  }, [staffRevision, router]);
  useEffect(() => {
    const controller = new AbortController();
    readService("/api/costs/commissions/access", controller.signal,
      (value): value is { allowed: boolean } => !!value && typeof value === "object" && typeof (value as { allowed?: unknown }).allowed === "boolean")
      .then(value => { if (!controller.signal.aborted) { setCommissionAccess(value.allowed); setCommissionIssue(null); } })
      .catch(caught => {
        if (controller.signal.aborted) return;
        setCommissionAccess(false);
        const issue = caught instanceof RequestError ? caught.issue : { title: "Connection problem", message: "Unable to check commission access." };
        if (issue.unauthorized) router.replace("/login");
        else if (issue.title !== "Access restricted") setCommissionIssue(issue);
      });
    return () => controller.abort();
  }, [commissionRevision, router]);

  useEffect(() => {
    const controller = new AbortController();
    setDashboardLoading(true); setDashboardError(null); setTotals(null);
    readService("/api/data/dashboard", controller.signal, isTotals).then(value => { if (!controller.signal.aborted) setTotals(value); }).catch(caught => {
      if (controller.signal.aborted) return;
      const issue = caught instanceof RequestError ? caught.issue : { title: "Connection problem", message: "Unable to load the dashboard." };
      if (issue.unauthorized) router.replace("/login"); else setDashboardError(issue);
    }).finally(() => { if (!controller.signal.aborted) setDashboardLoading(false); });
    return () => controller.abort();
  }, [dashboardRevision, router]);

  useEffect(() => {
    if (view === "overview") return;
    const controller = new AbortController();
    setLoading(true); setDirectoryError(null); setData(null);
    const url = "/api/data/" + view + "?page=" + page + "&size=10&q=" + encodeURIComponent(search);
    readService(url, controller.signal, isContactPage).then(value => { if (!controller.signal.aborted) setData(value); }).catch(caught => {
      if (controller.signal.aborted) return;
      const issue = caught instanceof RequestError ? caught.issue : { title: "Connection problem", message: "Unable to load the directory." };
      if (issue.unauthorized) router.replace("/login"); else setDirectoryError(issue);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [directoryRevision, page, router, search, view]);

  const refreshDashboard = useCallback(() => setDashboardRevision(value => value + 1), []);
  const refreshDirectory = useCallback(() => setDirectoryRevision(value => value + 1), []);
  useEffect(() => () => saveController.current?.abort(), []);
  useEffect(() => {
    const onPopState = () => {
      const next = new URLSearchParams(window.location.search).get("view");
      saveController.current?.abort(); setSaving(false); setFormOpen(false);
      setView(next === "customers" || next === "suppliers" ? next : "overview");
      setPage(0); setQuery(""); setSearch(""); setData(null); setDirectoryError(null); setWriteError("");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setFormOpen(false); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [formOpen, saving]);
  useEffect(() => {
    if (!formOpen && returnFocus.current) {
      if (returnFocus.current.isConnected) returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [formOpen]);

  function navigate(target: View) {
    if (target === view) return;
    window.history.pushState(null, "", target === "overview" ? "/workspace" : "/workspace?view=" + target);
    saveController.current?.abort();
    setSaving(false);
    setView(target);
    setPage(0);
    setQuery("");
    setSearch("");
    setFormOpen(false);
    setData(null);
    setDirectoryError(null);
    setWriteError("");
  }
  function openCreate() { if (!directoryWritable) return; returnFocus.current = document.activeElement as HTMLElement; setEditing(null); setFormError(""); setFormOpen(true); }
  function openEdit(contact: Contact) { if (!directoryWritable) return; returnFocus.current = document.activeElement as HTMLElement; setEditing(contact); setFormError(""); setFormOpen(true); }
  function keepFocusInDialog(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const elements = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
    if (!elements.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view === "overview" || !directoryWritable || saving) return;
    setFormError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["name", "email", "phone", "country"].map(key =>
      [key, String(form.get(key) || "").trim()]));
    if (!body.name) { setFormError("Enter a name that is not just spaces."); return; }
    setSaving(true);
    const controller = new AbortController();
    saveController.current = controller;
    try {
      const url = "/api/data/" + view + (editing ? "/" + encodeURIComponent(editing.id) : "");
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) {
        const message = response.status === 400 || response.status === 422 ? "Please check your details and try again." :
        response.status === 403 ? "You do not have permission to save this record." :
        response.status === 404 ? "Service not connected yet. This record was not saved." :
        response.status >= 500 ? "The service encountered an error. This record was not saved." : "Unable to save this record.";
        if (response.status === 403 || response.status === 404 || response.status >= 500) setWriteError(message);
        throw new Error(message);
      }
      setFormOpen(false);
      setEditing(null);
      if (!editing && page !== 0) setPage(0);
      else refreshDirectory();
      refreshDashboard();
    } catch (caught) {
      if (!controller.signal.aborted) {
        const message = caught instanceof TypeError ? "The service could not be reached. The save could not be confirmed." : caught instanceof Error ? caught.message : "Unable to save record.";
        if (caught instanceof TypeError) setWriteError(message);
        setFormError(message);
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (saveController.current === controller) saveController.current = null;
    }
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out could not revoke your session. Try again.");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Sign out could not revoke your session. Try again.");
    }
  }

  function exportPage() {
    if (view === "overview" || !data || data.content.length === 0) return;
    const fields = ["name", "email", "phone", "country", "createdAt"] as const;
    const escape = (value: string) => {
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
  const directoryTotal = (view === "customers" ? totals?.customers : totals?.suppliers) ?? (!search ? data?.totalElements : undefined);
  const directoryAvailable = !!data && !loading && !directoryError;
  const directoryWritable = directoryAvailable && !writeError && !!staff && ["ADMIN", "MANAGEMENT", "BD", "SOURCING"].includes(staff.role);

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
        <p className="nav-heading future-heading">TRADING OPERATIONS</p>
        <Link href="/workspace/rfqs" className="nav-item"><Icon name="layers" /><span>RFQ &amp; Sourcing</span></Link>
        <p className="nav-heading future-heading">BUSINESS MODULES</p>
        <Link href="/workspace/account" className="nav-item"><Icon name="lock" /><span>My security</span></Link>
        {commissionAccess&&<Link href="/workspace/costs/commissions" className="nav-item">
          <Icon name="lock"/><span>Commission vault</span></Link>}
        {enterpriseViews.map(item => <Link key={item.label} href={item.href} className="nav-item">
          <Icon name={item.icon} /><span>{item.label}</span></Link>)}
      </nav>
      <div className="sidebar-bottom">
        {commissionIssue && <div role="status"><small>{commissionIssue.title}: commission access could not be checked.</small> <button type="button" onClick={() => setCommissionRevision(value => value + 1)}>Retry</button></div>}
        <div className="side-status"><Icon name="lock" size={15} /><span>Private operations workspace</span></div>
        <div className="account-row"><div className="user-avatar">{staff?.username.slice(0, 1).toUpperCase() || "—"}</div><div className="account-info"><strong>{staff?.username || "Staff account"}</strong><small>{staff?.role || "Access not verified"}</small></div>
          <button className="icon-button signout" type="button" aria-label="Sign out" title="Sign out" onClick={() => void logout()}><Icon name="logout" /></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">SHL Operations <span>/</span> <strong>{title}</strong></div>
        <div className="topbar-end"><span className="topbar-tag"><span className="status-dot" /> Internal workspace</span><div className="topbar-avatar">{staff?.username.slice(0, 1).toUpperCase() || "—"}</div></div></header>
      <div className="content">
        {staffIssue && <ErrorNotice issue={staffIssue} retry={() => setStaffRevision(value => value + 1)} />}
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
          <div className="section-head"><div><p className="section-overline">{totals ? "DATABASE SNAPSHOT" : "DASHBOARD"}</p><h2>At a glance</h2></div>
            <button className="subtle-button" disabled={dashboardLoading} onClick={refreshDashboard}><Icon name="refresh" size={15} /> Refresh</button></div>
          <div className="metric-grid">
            <Metric label="Total relationships" value={totals ? totalRelationships : null} icon="layers" detail="Customers + suppliers" loading={dashboardLoading} />
            <Metric label="Customers" value={totals?.customers ?? null} icon="users" detail="In your customer directory" loading={dashboardLoading} />
            <Metric label="Suppliers" value={totals?.suppliers ?? null} icon="building" detail="In your supplier directory" loading={dashboardLoading} />
            <Metric label="RFQ pipeline" value={totals?.rfqs ?? null} icon="layers" detail="Saved sourcing requests" loading={dashboardLoading} />
          </div>
          {dashboardError && <ErrorNotice issue={dashboardError} retry={refreshDashboard} />}
          {error && <p className="notice error" role="alert">{error}</p>}
          <div className="overview-columns">
            <section className="surface mix-panel"><div className="surface-top"><div><p className="section-overline">RELATIONSHIP MIX</p><h2>Network composition</h2></div><span className="quiet-tag">{totals ? "DATABASE TOTALS" : "UNAVAILABLE"}</span></div>
              <div className="composition-row"><div className="composition-symbol"><Icon name="users" size={21} /></div>
                <div className="composition-info"><div><strong>Customers</strong><span>{totals ? totals.customers.toLocaleString() : "—"}</span></div>
                  <div className="progress-track"><span style={{ width: totalRelationships ? (100 * (totals?.customers ?? 0) / totalRelationships) + "%" : "0%" }} /></div></div></div>
              <div className="composition-row"><div className="composition-symbol supplier-symbol"><Icon name="building" size={21} /></div>
                <div className="composition-info"><div><strong>Suppliers</strong><span>{totals ? totals.suppliers.toLocaleString() : "—"}</span></div>
                  <div className="progress-track supplier-progress"><span style={{ width: totalRelationships ? (100 * (totals?.suppliers ?? 0) / totalRelationships) + "%" : "0%" }} /></div></div></div>
              <p className="surface-note">{!totals ? (dashboardLoading ? "Loading network data…" : "Network data is unavailable.") : totalRelationships === 0 ? "Your network is ready for its first record." : "Calculated from saved customer and supplier records."}</p>
            </section>
            <section className="surface quick-panel"><div className="surface-top"><div><p className="section-overline">QUICK ACTIONS</p><h2>Keep work moving</h2></div></div>
              <button className="quick-action" onClick={() => navigate("customers")}><div className="quick-icon"><Icon name="users" /></div><div><strong>Customer directory</strong><small>Search and manage customer records</small></div><Icon name="arrow" size={17} /></button>
              <button className="quick-action" onClick={() => navigate("suppliers")}><div className="quick-icon teal"><Icon name="building" /></div><div><strong>Supplier directory</strong><small>Maintain your trading network</small></div><Icon name="arrow" size={17} /></button>
              <Link href="/workspace/rfqs" className="quick-action"><div className="quick-icon teal"><Icon name="layers" /></div><div><strong>RFQ &amp; sourcing desk</strong><small>Capture inquiries and compare supplier offers</small></div><Icon name="arrow" size={17} /></Link>
            </section>
          </div>
          <div className="footnote"><Icon name="check" size={15} /> Figures are sourced from the application database. No sample metrics are displayed.</div>
        </> : <>
          <div className="page-heading"><div><p className="section-overline">RELATIONSHIP MANAGEMENT <span>/</span> {title.toUpperCase()}</p>
            <h1>{title}<span className="heading-period">.</span></h1>
            <p className="muted">Keep every {view === "customers" ? "customer" : "supplier"} relationship organized and accessible.</p></div>
            <button className="primary" disabled={!directoryWritable} onClick={openCreate}><Icon name="plus" size={17} /> Add {view === "customers" ? "customer" : "supplier"}</button></div>
          <div className="directory-stats"><div className="directory-icon"><Icon name={view === "customers" ? "users" : "building"} size={23} /></div>
            <div><p className="section-overline">DIRECTORY TOTAL</p><strong>{directoryTotal === undefined || directoryTotal === null ? "—" : directoryTotal.toLocaleString()}</strong></div>
            <span className="directory-tip">Saved records</span></div>
          {directoryError && <ErrorNotice issue={directoryError} retry={refreshDirectory} />}
          {writeError && <p className="notice error" role="alert">{writeError} Reopen this directory later to check again.</p>}
          {error && <p className="notice error" role="alert">{error}</p>}
          <section className="surface directory-panel" aria-label={title + " directory"}>
            <div className="table-toolbar"><div><h2>{title} directory</h2><p className="muted">{loading ? "Loading records…" : data ? data.totalElements.toLocaleString() + " matching records" : "Records unavailable"}</p></div>
              <div className="toolbar-actions">
                <form className="search-form" onSubmit={event => { event.preventDefault(); const term = query.trim(); if (search !== term || page !== 0) { setPage(0); setSearch(term); } }}>
                  <Icon name="search" size={17} /><input aria-label={"Search " + title.toLowerCase()} placeholder="Search by name" value={query} onChange={event => setQuery(event.target.value)} />
                  <button type="submit">Search</button></form>
                <button className="outline-icon" aria-label="Refresh records" title="Refresh records" disabled={loading} onClick={refreshDirectory}><Icon name="refresh" size={17} /></button>
                <button className="outline-icon" aria-label="Export current page to CSV" title="Export current page to CSV" disabled={!directoryAvailable || !data?.content.length} onClick={exportPage}><Icon name="download" size={17} /></button>
              </div></div>
            <div className="table-wrap" aria-busy={loading}><table><thead><tr><th>NAME</th><th>EMAIL</th><th>PHONE</th><th>COUNTRY</th><th>ADDED</th><th>ACTION</th></tr></thead>
              <tbody>{!loading && data?.content.map(item => <tr key={item.id}><td><div className="person"><span className="initial">{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong></div></td>
                <td>{item.email ? <a className="data-link" href={"mailto:" + item.email}>{item.email}</a> : "—"}</td>
                <td>{item.phone || "—"}</td><td>{item.country || "—"}</td>
                <td>{Number.isNaN(Date.parse(item.createdAt)) ? "—" : new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td><button className="edit-button" disabled={!directoryWritable} onClick={() => openEdit(item)}><Icon name="edit" size={14} /> Edit</button></td></tr>)}</tbody></table>
              {loading && <div className="table-state" role="status"><span className="loading-spinner" /> Loading records…</div>}
              {!loading && data && data.content.length === 0 && <div className="empty"><div className="empty-illustration"><Icon name={view === "customers" ? "users" : "building"} size={30} /></div>
                <h3>{search ? "No matching records" : "Your directory starts here"}</h3>
                <p>{search ? "Try another name or clear your search." : "Add your first " + (view === "customers" ? "customer" : "supplier") + " to begin building your network."}</p>
                {!search && <button className="primary" disabled={!directoryWritable} onClick={openCreate}><Icon name="plus" size={16} /> Add first record</button>}</div>}</div>
            {data && !loading && <div className="pagination"><span>Page {page + 1} of {Math.max(1, data.totalPages)}</span><div className="pager-buttons">
              <button disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}>Previous</button>
              <button disabled={page + 1 >= data.totalPages} onClick={() => setPage(current => current + 1)}>Next</button></div></div>}
          </section>
          <p className="directory-footnote">CSV exports include the visible page only. Changes are saved through the private SHL API.</p>
        </>}
      </div>
    </main>

    {formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onKeyDown={keepFocusInDialog}>
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
            <button className="primary" type="submit" disabled={saving || !directoryWritable}>{saving ? "Saving…" : editing ? "Save changes" : "Create record"} <Icon name="arrow" size={15} /></button></div>
        </form>
      </section></div>}
  </div>;
}

function Metric({ label, value, icon, detail, loading }: { label: string; value: number | null; icon: IconName; detail: string; loading: boolean }) {
  return <article className="metric"><div className="metric-head"><span>{label}</span><span className="metric-icon"><Icon name={icon} size={20} /></span></div>
    <strong aria-live="polite">{loading || value === null ? "—" : value.toLocaleString()}</strong>
    <div className="metric-footer"><span className="metric-foot-dot" /> {detail}</div></article>;
}
function ErrorNotice({ issue, retry }: { issue: ServiceIssue; retry: () => void }) {
  return <div className="notice error" role="alert"><span><strong>{issue.title}</strong><br />{issue.message}</span><button type="button" onClick={retry}>Retry</button></div>;
}
