"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
type InvoiceAging={currency:string;invoice_type:string;invoice_count:number;outstanding:number|string};
type Shipment={reference:string;origin:string;destination:string;eta:string|null;status:string};
type Task={id:string;title:string;priority:string;due_date:string|null;status:string;assignee:string};
type Summary={
  asOfUtc:string;customers:number;suppliers:number;leadsActive:number;leadsWon:number;
  rfqsOpen:number;salesOpen:number;projectsActive:number;projectsOverdue:number;
  shipmentsTransit:number;shipmentsLate:number;tasksOverdue:number;invoicesOverdue:number;
  outstandingByCurrency:InvoiceAging[];nextShipments:Shipment[];nextTasks:Task[];
};
const menu=[
  {label:"Overview",href:"/workspace",symbol:"▦"},
  {label:"CRM & leads",href:"/workspace/growth/leads",symbol:"◎"},
  {label:"Trading RFQs",href:"/workspace/rfqs",symbol:"◈"},
  {label:"Sales orders",href:"/workspace/enterprise/orders",symbol:"▣"},
  {label:"Shipments",href:"/workspace/enterprise/shipments",symbol:"⇢"},
  {label:"Finance",href:"/workspace/enterprise/invoices",symbol:"◇"},
  {label:"Projects",href:"/workspace/growth/projects",symbol:"⬡"},
  {label:"Company registry",href:"/workspace/entities",symbol:"♧"},
  {label:"Due date alerts",href:"/workspace/alerts",symbol:"◉"},
  {label:"Audit trail",href:"/workspace/enterprise/audit",symbol:"☷"},
];
const number=(n:number)=>new Intl.NumberFormat("en-US").format(n);
function date(value:string|null) {
  if(!value)return "Not scheduled";
  const parsed=new Date(value.slice(0,10)+"T12:00:00Z");
  return Number.isNaN(parsed.getTime())?"Not scheduled":parsed.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});
}
function money(v:number|string,unit:string){
  const amount=Number(v);
  if(!Number.isFinite(amount))return String(v)+" "+unit;
  return new Intl.NumberFormat("en-US",{maximumFractionDigits:2,minimumFractionDigits:2}).format(amount)+" "+unit;
}
export function ExecutiveCockpit(){
  const [summary,setSummary]=useState<Summary|null>(null);
  const [error,setError]=useState("");
  const [restricted,setRestricted]=useState(false);
  const [loading,setLoading]=useState(true);
  const [tick,setTick]=useState(0);
  const refresh=useCallback(()=>{setLoading(true);setTick(v=>v+1);},[]);
  useEffect(()=>{
    let alive=true;
    fetch("/api/command-center",{cache:"no-store"}).then(async r=>{
      if(r.status===401){window.location.assign("/login");return;}
      if(r.status===403){if(alive)setRestricted(true);return;}
      if(!r.ok)throw new Error("Unable to access live business metrics (HTTP "+r.status+")");
      const data=await r.json() as Summary;
      if(alive){setSummary(data);setError("");setRestricted(false);}
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Unable to load metrics");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[tick]);
  if(restricted)return <main className="cc-restricted">
    <span>◈</span><h1>Management access required</h1>
    <p>This cockpit contains financial and business-level aggregates. Contact a management administrator if your role requires access.</p>
    <Link href="/workspace">Return to operations ↗</Link>
  </main>;

  const tiles=summary?[
    {eyebrow:"COMMERCIAL PIPELINE",count:summary.leadsActive,label:"Active leads",icon:"✧",tone:"blue"},
    {eyebrow:"OPEN TRANSACTIONS",count:summary.salesOpen,label:"Sales orders in progress",icon:"▣",tone:"green"},
    {eyebrow:"FREIGHT NETWORK",count:summary.shipmentsTransit,label:"Shipments in transit",icon:"⇢",tone:"violet"},
    {eyebrow:"PROJECT EXECUTION",count:summary.projectsActive,label:"Active and planned projects",icon:"⬡",tone:"amber"}
  ]:[];
  const risks=summary?[
    {name:"Projects overdue",value:summary.projectsOverdue,href:"/workspace/growth/projects"},
    {name:"Shipment ETA exceeded",value:summary.shipmentsLate,href:"/workspace/enterprise/shipments"},
    {name:"Team tasks overdue",value:summary.tasksOverdue,href:"/workspace/enterprise/tasks"},
    {name:"Invoices past due",value:summary.invoicesOverdue,href:"/workspace/enterprise/invoices"}
  ]:[];

  return <div className="cc-app">
    <aside className="cc-rail">
      <Link className="cc-logo" href="/workspace"><span className="cc-mark">S</span><span><strong>SHL<span>.</span></strong><small>INTERNATIONAL</small></span></Link>
      <div className="cc-rail-tag"><span className="cc-led"/> OPERATIONS INTELLIGENCE</div>
      <p className="cc-rail-title">EXECUTIVE WORKSPACE</p>
      <Link href="/workspace/command-center" className="cc-link cc-current"><span>▦</span>Mission control <i/></Link>
      <p className="cc-rail-title">BUSINESS MODULES</p>
      <nav aria-label="Executive modules">{menu.map(m=><Link key={m.href} href={m.href} className="cc-link"><span>{m.symbol}</span>{m.label}</Link>)}</nav>
      <div className="cc-rail-bottom"><div className="cc-shield">◈ <span>Restricted · Management only</span></div>
        <Link href="/workspace/account">Account security ↗</Link></div>
    </aside>
    <div className="cc-main">
      <header className="cc-header">
        <div><span>OPERATIONS OS</span><b>/</b><strong>Executive command center</strong></div>
        <div className="cc-header-right"><span className="cc-header-private"><i/> INTERNAL ACCESS</span>
          <Link href="/workspace">Main workspace ↗</Link></div>
      </header>
      <main className="cc-content">
        <section className="cc-hero">
          <div className="cc-hero-copy"><div className="cc-hero-kicker"><span/> THE SHL COMMAND CENTER</div>
            <h1>Clarity across<br/><em>every operation.</em></h1>
            <p>One connected view of commercial momentum, order execution, freight movement and financial exposure. Real figures only; no invented KPIs.</p>
            <div className="cc-hero-actions"><button type="button" onClick={refresh} disabled={loading}>{loading?"Refreshing…":"↻  Refresh intelligence"}</button>
              <Link href="/workspace/alerts">Review alerts ↗</Link></div>
          </div>
          <div className="cc-hero-orbit" aria-hidden="true"><div className="cc-orbit-circle one"/><div className="cc-orbit-circle two"/><div className="cc-orbit-circle three"/><div className="cc-orbit-core"><strong>SHL</strong><span>OPERATIONS</span></div><i className="cc-node a"/><i className="cc-node b"/><i className="cc-node c"/></div>
        </section>
        <div className="cc-meta"><span><i className="cc-pulse"/> {summary?"DATABASE SNAPSHOT · "+summary.asOfUtc+" UTC":"LIVE ACCESS · AUTHENTICATED DATA"}</span>
          <span>No FX conversion or unverified profit assumptions</span></div>
        {error&&<div className="cc-error" role="alert"><span>{error}</span><button type="button" onClick={refresh}>Retry</button></div>}
        {loading&&!summary&&<div className="cc-loading" role="status">Loading secured operations data…</div>}
        {summary&&<>
          <div className="cc-titleline"><div><p>PERFORMANCE PULSE</p><h2>Operational overview</h2></div><span>Values from PostgreSQL</span></div>
          <div className="cc-stats">{tiles.map(tile=><article key={tile.eyebrow} className={"cc-stat cc-"+tile.tone}>
            <div className="cc-stat-top"><span>{tile.eyebrow}</span><i>{tile.icon}</i></div>
            <strong>{number(tile.count)}</strong><p>{tile.label}</p>
            <div className="cc-stat-rule"/></article>)}</div>
          <div className="cc-main-grid">
            <section className="cc-panel">
              <div className="cc-panel-head"><div><p className="cc-eyebrow">MANAGEMENT ATTENTION</p><h2>Exceptions that matter</h2><small>Items requiring follow-up or verification</small></div>
                <Link href="/workspace/alerts">Open alerts ↗</Link></div>
              <div className="cc-exceptions">{risks.map(r=><Link key={r.name} href={r.href} className="cc-exception">
                <span className={"cc-risk-dot "+(r.value>0?"attention":"clear")}/><span>{r.name}</span>
                <strong className={r.value>0?"cc-risk-number":""}>{number(r.value)}</strong><b>↗</b>
              </Link>)}</div>
              <div className="cc-panel-foot">Counts are source-of-truth workflow records, not independently verified business outcomes.</div>
            </section>
            <section className="cc-panel cc-ledger">
              <div className="cc-panel-head"><div><p className="cc-eyebrow">FINANCIAL VISIBILITY</p><h2>Outstanding by currency</h2><small>Issued invoices, net of payments recorded</small></div>
                <Link href="/workspace/enterprise/invoices">Finance ↗</Link></div>
              {summary.outstandingByCurrency.length?
                <div className="cc-amounts">{summary.outstandingByCurrency.map((r,i)=><div className="cc-amount" key={r.currency+"-"+r.invoice_type+"-"+i}>
                  <div><span>{r.invoice_type==="RECEIVABLE"?"Receivable":"Payable"}</span>
                    <strong>{r.currency.trim()}</strong></div>
                  <b>{money(r.outstanding,r.currency.trim())}</b>
                  <small>{number(Number(r.invoice_count))} issued invoices</small>
                </div>)}</div>:
                <div className="cc-empty"><span>◎</span><strong>No outstanding issued invoices</strong><p>Financial totals appear when eligible invoices exist.</p></div>}
              <div className="cc-panel-foot">Currencies remain separate. These values are not audited revenue, cash flow or profit.</div>
            </section>
          </div>
          <div className="cc-secondary-grid">
            <section className="cc-panel"><div className="cc-panel-head"><div>
              <p className="cc-eyebrow">FREIGHT EXECUTION</p><h2>Shipping watchlist</h2><small>Current booked and moving shipments</small></div>
              <Link href="/workspace/enterprise/shipments">All shipments ↗</Link></div>
              {summary.nextShipments.length?<div className="cc-records">{summary.nextShipments.map((s,i)=><div key={s.reference+"-"+i} className="cc-record">
                <span className="cc-record-icon">⇢</span><div><strong>{s.reference}</strong><p>{s.origin} → {s.destination}</p></div>
                <div className="cc-record-right"><span>{s.status.replaceAll("_"," ")}</span><small>{date(s.eta)}</small></div></div>)}</div>:
                <div className="cc-empty"><span>⇢</span><strong>No active shipments</strong><p>Booked shipments will appear here when entered.</p></div>}
            </section>
            <section className="cc-panel"><div className="cc-panel-head"><div>
              <p className="cc-eyebrow">ACCOUNTABLE EXECUTION</p><h2>Team action queue</h2><small>Open work ordered by due date</small></div>
              <Link href="/workspace/enterprise/tasks">Team tasks ↗</Link></div>
              {summary.nextTasks.length?<div className="cc-records">{summary.nextTasks.map(task=><div key={task.id} className="cc-record">
                <span className="cc-record-icon cc-tasks-icon">✓</span><div><strong>{task.title}</strong>
                  <p>{task.assignee} · {task.priority}</p></div>
                <div className="cc-record-right"><span>{task.status.replaceAll("_"," ")}</span><small>{date(task.due_date)}</small></div></div>)}</div>:
                <div className="cc-empty"><span>✓</span><strong>No open team tasks</strong><p>Assigned actions and deadlines appear here.</p></div>}
            </section>
          </div>
          <div className="cc-footer-bar"><div><span>COMMERCIAL REACH</span><strong>{number(summary.customers)} customers · {number(summary.suppliers)} suppliers</strong></div>
            <div><span>TRADE ACTIVITY</span><strong>{number(summary.rfqsOpen)} open RFQs · {number(summary.leadsWon)} won leads</strong></div>
            <Link href="/workspace/entities">Corporate master data ↗</Link>
          </div>
        </>}
        <p className="cc-disclaimer">SHL Operations OS · Development environment · Independent security review, backups and approval gates remain mandatory before real company data or production launch.</p>
      </main>
    </div>
  </div>;
}
