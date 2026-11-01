"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Shipment = {
  reference: string;
  origin: string;
  destination: string;
  eta: string | null;
  status: string;
};
type Task = {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
  assignee: string;
};
export type DailyDeskSnapshot = {
  projectsOverdue: number;
  shipmentsLate: number;
  tasksOverdue: number;
  invoicesOverdue: number;
  nextShipments: Shipment[];
  nextTasks: Task[];
};
type FocusTab = "all" | "shipments" | "tasks";

const actionRoutes = [
  { label: "New inquiry", detail: "Start with the customer and RFQ", href: "/workspace/rfqs", icon: "✧" },
  { label: "Compare suppliers", detail: "Review source quotes and terms", href: "/workspace/rfqs", icon: "◈" },
  { label: "Track a shipment", detail: "Check milestones and documents", href: "/workspace/enterprise/shipments", icon: "⇢" },
  { label: "Assign a task", detail: "Keep the next owner accountable", href: "/workspace/enterprise/tasks", icon: "✓" },
];

function displayDate(value: string | null) {
  if (!value) return "Date not set";
  const parsed = new Date(value.slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(parsed.getTime())) return "Date not set";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}
function statusText(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
function count(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function DailyDesk({ summary }: { summary: DailyDeskSnapshot }) {
  const [tab, setTab] = useState<FocusTab>("all");
  const [search, setSearch] = useState("");
  const attention = [
    { label: "Shipment delays", value: summary.shipmentsLate, href: "/workspace/enterprise/shipments", guidance: "Review ETAs and notify the owner" },
    { label: "Overdue team tasks", value: summary.tasksOverdue, href: "/workspace/enterprise/tasks", guidance: "Check blockers and reassign if needed" },
    { label: "Overdue projects", value: summary.projectsOverdue, href: "/workspace/growth/projects", guidance: "Confirm next milestone and owner" },
    { label: "Overdue invoices", value: summary.invoicesOverdue, href: "/workspace/enterprise/invoices", guidance: "Review outstanding balances" },
  ];
  const priorityGroups = attention.filter(item => item.value > 0);
  const query = search.trim().toLocaleLowerCase();
  const { shipments, tasks } = useMemo(() => ({
    shipments: summary.nextShipments.filter(s =>
      [s.reference, s.origin, s.destination, s.status].some(v => v.toLocaleLowerCase().includes(query))),
    tasks: summary.nextTasks.filter(t =>
      [t.title, t.assignee, t.priority, t.status].some(v => v.toLocaleLowerCase().includes(query))),
  }), [query, summary.nextShipments, summary.nextTasks]);
  const hasAnyRecords = (tab !== "tasks" && shipments.length > 0) ||
    (tab !== "shipments" && tasks.length > 0);

  return <section className="bd-desk" aria-labelledby="bd-desk-title">
    <div className="bd-heading">
      <div>
        <p className="bd-eyebrow"><span aria-hidden="true">✦</span> DAILY DECISION DESK</p>
        <h2 id="bd-desk-title">Your day, simplified.</h2>
        <p>See what needs attention, open the right workspace, and keep every handoff moving.</p>
      </div>
      <Link href="/workspace/alerts" className="bd-text-link">View all alerts <span aria-hidden="true">↗</span></Link>
    </div>

    <div className="bd-priority" aria-live="polite">
      <div className="bd-priority-head">
        <span className={"bd-priority-icon " + (priorityGroups.length ? "bd-priority-warn" : "bd-priority-ok")} aria-hidden="true">
          {priorityGroups.length ? "!" : "✓"}
        </span>
        <div>
          <strong>{priorityGroups.length
            ? priorityGroups.length + " exception categories need review"
            : "No overdue exceptions in the four monitored categories"}</strong>
          <p>{priorityGroups.length
            ? "Review the source records before taking action. Categories may overlap."
            : "New alerts can still appear elsewhere. Last available database snapshot is shown above."}</p>
        </div>
      </div>
      {priorityGroups.length > 0 && <div className="bd-priority-links">
        {priorityGroups.map(item => <Link key={item.label} href={item.href} className="bd-priority-item">
          <span><b>{count(item.value)}</b><strong>{item.label}</strong><small>{item.guidance}</small></span>
          <span className="bd-priority-arrow" aria-hidden="true">↗</span>
        </Link>)}
      </div>}
    </div>

    <div className="bd-heading bd-actions-heading">
      <div><p className="bd-eyebrow">COMMON ACTIONS</p><h3>One click to the next step</h3></div>
    </div>
    <div className="bd-shortcuts">
      {actionRoutes.map(item => <Link key={item.label} href={item.href} className="bd-shortcut">
        <span className="bd-shortcut-icon" aria-hidden="true">{item.icon}</span>
        <strong>{item.label}</strong>
        <small>{item.detail}</small>
        <span className="bd-shortcut-go" aria-hidden="true">↗</span>
      </Link>)}
    </div>

    <div className="bd-watchlist">
      <div className="bd-watchlist-head">
        <div><p className="bd-eyebrow">LIVE SNAPSHOT</p><h3>What is moving right now</h3>
          <p>Search only the shipment and task records included in this management snapshot.</p></div>
        <div className="bd-watchlist-search">
          <label htmlFor="bd-watch-search">Filter this snapshot</label>
          <input id="bd-watch-search" type="search" value={search}
            placeholder="Reference, owner, route, task…"
            onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="bd-tabs" role="group" aria-label="Filter watchlist type">
        {([
          { key: "all", title: "All records" },
          { key: "shipments", title: "Shipments" },
          { key: "tasks", title: "Team tasks" },
        ] as const).map(item => <button key={item.key} type="button"
          className={tab === item.key ? "bd-tab bd-selected" : "bd-tab"}
          aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>{item.title}</button>)}
      </div>
      {hasAnyRecords ? <div className="bd-watchlist-grid">
        {tab !== "tasks" && shipments.length > 0 && <div className="bd-watch-panel">
          <div className="bd-list-title"><h4>Shipment watch</h4><Link href="/workspace/enterprise/shipments">Open shipping ↗</Link></div>
          {shipments.map((s, i) => <div className="bd-watch-row" key={s.reference + "-" + i}>
            <span className="bd-list-icon" aria-hidden="true">⇢</span>
            <div className="bd-row-main"><strong>{s.reference}</strong>
              <small>{s.origin} → {s.destination}</small></div>
            <div className="bd-row-trailing"><span>{statusText(s.status)}</span><small>ETA {displayDate(s.eta)}</small></div>
          </div>)}
        </div>}
        {tab !== "shipments" && tasks.length > 0 && <div className="bd-watch-panel">
          <div className="bd-list-title"><h4>Team follow-ups</h4><Link href="/workspace/enterprise/tasks">Open tasks ↗</Link></div>
          {tasks.map(t => <div className="bd-watch-row" key={t.id}>
            <span className="bd-list-icon bd-task-icon" aria-hidden="true">✓</span>
            <div className="bd-row-main"><strong>{t.title}</strong>
              <small>{t.assignee || "Unassigned"} · {statusText(t.priority)}</small></div>
            <div className="bd-row-trailing"><span>{statusText(t.status)}</span><small>Due {displayDate(t.due_date)}</small></div>
          </div>)}
        </div>}
      </div> : <div className="bd-list-empty" role="status">
        <strong>{search ? "No matching records in this snapshot" : "No records in this snapshot"}</strong>
        <span>{search ? "Try another term, or open the full module for complete search." :
          "Use the dedicated workspace to manage orders, shipping, and tasks."}</span>
      </div>}
      <p className="bd-snapshot-note">The command center shows a limited, permission-controlled snapshot—not a global record search, carrier feed, or verified shipment tracking service.</p>
    </div>
  </section>;
}
