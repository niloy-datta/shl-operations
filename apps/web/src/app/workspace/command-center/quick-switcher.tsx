"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

const destinations = [
  { name: "Executive command center", group: "Overview", href: "/workspace/command-center", tags: "dashboard management boudi" },
  { name: "Customers and suppliers", group: "Directory", href: "/workspace", tags: "contacts accounts master data" },
  { name: "Lead pipeline", group: "Commercial", href: "/workspace/growth/leads", tags: "crm prospect followup" },
  { name: "RFQ and sourcing", group: "Commercial", href: "/workspace/rfqs", tags: "inquiry quotation supplier offers" },
  { name: "Customer quotations", group: "Commercial", href: "/workspace/enterprise/quotes", tags: "quote sales offer" },
  { name: "Sales orders", group: "Commercial", href: "/workspace/enterprise/orders", tags: "order sales" },
  { name: "Purchase orders", group: "Commercial", href: "/workspace/enterprise/purchase-orders", tags: "procurement vendor" },
  { name: "Shipments", group: "Logistics", href: "/workspace/enterprise/shipments", tags: "freight eta etd delivery" },
  { name: "Consignees", group: "Logistics", href: "/workspace/consignees", tags: "recipient delivery destination" },
  { name: "Projects and jobs", group: "Operations", href: "/workspace/growth/projects", tags: "project milestones" },
  { name: "Team tasks", group: "Operations", href: "/workspace/enterprise/tasks", tags: "assign work owners" },
  { name: "Due dates and alerts", group: "Operations", href: "/workspace/alerts", tags: "overdue warning reminders" },
  { name: "Invoices and payments", group: "Finance", href: "/workspace/enterprise/invoices", tags: "receivable payable finance" },
  { name: "Expenses", group: "Finance", href: "/workspace/costs/expenses", tags: "cost" },
  { name: "Company registry", group: "Master data", href: "/workspace/entities", tags: "company branch global" },
  { name: "Staff and audit", group: "Admin", href: "/workspace/enterprise/staff", tags: "permissions team security" },
  { name: "Account security", group: "Admin", href: "/workspace/account", tags: "mfa password" },
];

export function QuickSwitcher() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const hasOpened = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(current => !current);
      } else if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      hasOpened.current = true;
      inputRef.current?.focus();
    } else if (hasOpened.current) launchRef.current?.focus();
  }, [open]);

  function keepFocusInside(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const elements = dialogRef.current?.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled]), a[href]");
    if (!elements?.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const value = term.trim().toLocaleLowerCase();
  const matching = destinations.filter(item =>
    !value || [item.name, item.group, item.tags].some(s => s.toLocaleLowerCase().includes(value)));

  return <>
    <button className="qs-launch" type="button" onClick={() => setOpen(true)} ref={launchRef}
      aria-haspopup="dialog" aria-expanded={open} aria-controls="qs-dialog">
      <span aria-hidden="true">⌕</span> <span>Jump to module</span> <kbd>Ctrl K</kbd>
    </button>
    {open && <div className="qs-overlay">
      <button type="button" className="qs-scrim" onClick={() => setOpen(false)}
        aria-label="Close module search" tabIndex={-1}/>
      <section id="qs-dialog" role="dialog" aria-modal="true" aria-label="Find a workspace module"
        className="qs-dialog" ref={dialogRef} onKeyDown={keepFocusInside}>
        <div className="qs-search-row">
          <span aria-hidden="true">⌕</span>
          <input ref={inputRef} value={term} onChange={e => setTerm(e.target.value)} type="search"
            placeholder="Find a workspace module…" aria-label="Search module names and categories"/>
          <button type="button" className="qs-close" onClick={() => setOpen(false)}
            aria-label="Close search">Esc</button>
        </div>
        <div className="qs-results">
          {matching.length ? matching.map(item => <Link href={item.href} key={item.href}
            className="qs-result" onClick={() => { setOpen(false); setTerm(""); }}>
            <span><strong>{item.name}</strong><small>{item.group}</small></span><b aria-hidden="true">↗</b>
          </Link>) : <div className="qs-no-result" role="status">No modules match this search. Try RFQ, shipments, invoices, or tasks.</div>}
        </div>
        <p className="qs-help">This searches navigation only. Customer records and documents are not searched or exposed here.</p>
      </section>
    </div>}
  </>;
}
