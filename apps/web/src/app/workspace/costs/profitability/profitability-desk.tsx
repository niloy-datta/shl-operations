"use client";

import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
type Row=Record<string,unknown>;
type User={username:string;role:string};
type Page={content:Row[];totalElements:number;totalPages:number};
const currency=(v:unknown)=>v===null||v===undefined?"—":new Intl.NumberFormat(
  "en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v));
export function ProfitabilityDesk(){
  const router=useRouter();
  const [me,setMe]=useState<User|null>(null);
  const [page,setPage]=useState(0),[term,setTerm]=useState(""),[query,setQuery]=useState("");
  const [result,setResult]=useState<Page>({content:[],totalElements:0,totalPages:0});
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const auth=await fetch("/api/data/me",{cache:"no-store"});
      if(auth.status===401){router.replace("/login");return;}
      if(!auth.ok)throw new Error("Unable to verify account.");
      const profile=await auth.json() as User;setMe(profile);
      if(!["ADMIN","MANAGEMENT","FINANCE"].includes(profile.role)){
        setError("Restricted to authorized financial users.");return;
      }
      const res=await fetch("/api/costs/profitability?"+new URLSearchParams({
        page:String(page),size:"15",q:term
      }),{cache:"no-store"});
      if(!res.ok)throw new Error("Unable to load profitability estimates.");
      setResult(await res.json() as Page);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load reports.");}
    finally{setLoading(false);}
  },[page,term,router]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{void load();});
    return()=>cancelAnimationFrame(frame);},[load]);
  return <div className="en-app">
    <aside className="en-sidebar"><Link className="en-brand" href="/workspace">
      <span className="en-logo">S</span><span><strong>SHL<span>.</span></strong><small>INTERNATIONAL</small></span>
    </Link><div className="en-edition"><span className="en-dot"/> FINANCE INTELLIGENCE <span>CONTROLLED</span></div>
      <div className="en-nav-scroll"><p className="en-nav-label">REPORTING WORKSPACE</p>
        <nav>
          {[
            ["/workspace","▦","Overview"],["/workspace/costs/profitability","◴","Project contribution"],
            ["/workspace/costs/expenses","◎","Expenses"],
            ["/workspace/enterprise/invoices","▥","Invoices"],
            ["/workspace/growth/projects","▱","Projects"],["/workspace/alerts","◉","Alerts"]
          ].map(([url,sym,label])=><Link key={url} href={url} className={"en-nav-item "+
            (url.endsWith("/profitability")?"active":"")}>
            <span className="en-nav-symbol">{sym}</span>{label}</Link>)}
        </nav></div><div className="en-sidebar-bottom"><p className="en-private">◈ Estimates, not audited financial statements</p></div>
    </aside>
    <div className="en-main"><header className="en-topbar"><div>SHL Operations <span>/</span> <strong>Project contribution</strong></div>
      <Link href="/workspace">Dashboard ↗</Link></header>
      <main className="en-content gx-content">
        <div className="en-heading"><div><p className="en-eyebrow">FINANCIAL INSIGHT <span>/</span> CURRENCY-SAFE REPORTS</p>
          <h1>Project contribution<span>.</span></h1>
          <p>Compare order values, committed purchasing and approved direct expenses.</p>
        </div><button className="en-primary" onClick={()=>void load()} disabled={loading}>
          {loading?"Loading…":"↻ Refresh"}</button></div>
        <section className="gx-banner"><div>
          <span className="gx-kicker">EVIDENCE-LED NUMBERS</span>
          <h2>No invented profits. No mixed currencies.</h2>
          <p>Estimates appear only when issued purchase-order quantity matches the approved customer quote and no draft expense remains.</p>
        </div><div className="gx-metric"><strong>{result.totalElements}</strong><small>PROJECTS</small></div></section>
        {error&&<div className="en-alert" role="alert">{error}</div>}
        {me&&["ADMIN","MANAGEMENT","FINANCE"].includes(me.role)&&<section className="en-panel gx-list">
          <div className="gx-toolbar"><div><strong>Project-level financial snapshots</strong>
            <span>Order contract value minus committed purchase cost and approved expenses</span></div>
            <form className="gx-search" onSubmit={e=>{e.preventDefault();setPage(0);setTerm(query);}}>
              <input value={query} onChange={e=>setQuery(e.target.value)}
                aria-label="Search projects" placeholder="Search project title or job ID"/>
              <button>Search</button></form></div>
          <div className="gx-table-wrap"><table className="gx-table"><thead><tr>
            <th>PROJECT</th><th>CUSTOMER</th><th>ORDER VALUE</th><th>PURCHASE</th><th>APPROVED EXPENSE</th>
            <th>CONTRIBUTION ESTIMATE</th></tr></thead>
            <tbody>{result.content.map(row=><tr key={String(row.id)}>
              <td><strong>{String(row.reference)}</strong><div className="cx-row-subtitle">{String(row.title)}</div></td>
              <td>{String(row.customer_name)}</td>
              <td>{row.order_value===null?"—":String(row.currency)+" "+currency(row.order_value)}</td>
              <td>{row.order_value===null?"—":String(row.currency)+" "+currency(row.committed_purchase_cost)}</td>
              <td>{row.order_value===null?"—":String(row.currency)+" "+currency(row.approved_expenses)}</td>
              <td>{row.provisional_contribution===null?
                <span className="gx-stage gx-on_hold">INSUFFICIENT DATA</span>:
                <strong>{String(row.currency)+" "+currency(row.provisional_contribution)}</strong>}</td>
            </tr>)}</tbody></table>
            {!loading&&result.content.length===0&&<div className="gx-empty">
              <strong>No matching projects</strong><p>Only saved customer projects appear here.</p></div>}
            {loading&&<p className="gx-loading">Loading project evidence…</p>}
          </div>
          <div className="gx-pagination"><span>Separate source currencies · no FX conversion</span><div>
            <button onClick={()=>setPage(p=>p-1)} disabled={page===0}>← Previous</button>
            <button onClick={()=>setPage(p=>p+1)} disabled={page+1>=result.totalPages}>Next →</button>
          </div></div>
        </section>}
        <p className="cx-disclaimer">Important: This is a provisional commercial contribution, not recognized revenue,
          booked profit, cash flow, full cost accounting, tax-adjusted profit, or commission-adjusted margin.
          It excludes confidential commissions and unrecorded expenses. Approval and reconciliation are still required.</p>
      </main>
    </div>
  </div>;
}
