"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";

type Alert={source:string;reference:string;title:string;dueDate:string;urgency:string;url:string};
type Feed={items:Alert[];overdue:number;dueToday:number;upcoming:number;timezone:string};
const empty:Feed={items:[],overdue:0,dueToday:0,upcoming:0,timezone:"UTC"};
export function AlertsDesk(){
  const router=useRouter();
  const [feed,setFeed]=useState<Feed>(empty);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("ALL");
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/alerts",{cache:"no-store"});
      if(response.status===401){router.replace("/login");return;}
      if(!response.ok)throw new Error("Unable to load operational alerts.");
      setFeed(await response.json() as Feed);setError("");
    }catch(e){setError(e instanceof Error?e.message:"Unable to load alerts.");}
    finally{setLoading(false);}
  },[router]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{void load();});
    return()=>cancelAnimationFrame(frame);},[load]);
  const filtered=feed.items.filter(x=>filter==="ALL"||x.urgency===filter);
  return <div className="en-app">
    <aside className="en-sidebar">
      <Link href="/workspace" className="en-brand"><span className="en-logo">S</span>
        <span><strong>SHL<span>.</span></strong><small>INTERNATIONAL</small></span></Link>
      <div className="en-edition"><span className="en-dot"/> OPERATIONS OS <span>LIVE</span></div>
      <div className="en-nav-scroll"><p className="en-nav-label">BUSINESS OPERATIONS</p>
        <nav aria-label="Alerts navigation">
          {[
            ["/workspace","▦","Overview"],
            ["/workspace/alerts","◉","Due dates & alerts"],
            ["/workspace/growth/leads","✧","Lead pipeline"],
            ["/workspace/growth/projects","▱","Projects"],
            ["/workspace/enterprise/tasks","☷","Team tasks"],
            ["/workspace/enterprise/shipments","⇢","Shipments"],
            ["/workspace/enterprise/invoices","▥","Invoices"]
          ].map(([href,symbol,label])=><Link key={href} href={href}
            className={"en-nav-item "+(href.endsWith("/alerts")?"active":"")}>
            <span className="en-nav-symbol">{symbol}</span>{label}</Link>)}
        </nav>
      </div>
      <div className="en-sidebar-bottom"><p className="en-private">◈ Read-only, identity-filtered alerts</p></div>
    </aside>
    <div className="en-main">
      <header className="en-topbar"><div>SHL Operations <span>/</span> <strong>Operational alerts</strong></div>
        <Link href="/workspace">Dashboard ↗</Link></header>
      <main className="en-content gx-content">
        <div className="en-heading"><div><p className="en-eyebrow">DELIVERY INTELLIGENCE <span>/</span> ACTION QUEUE</p>
          <h1>What needs attention<span>.</span></h1>
          <p>Live due dates across your permitted workstreams. No fake notifications or automated messages.</p>
        </div><button className="en-primary" disabled={loading} onClick={()=>void load()}>
          {loading?"Refreshing…":"↻ Refresh alerts"}</button></div>
        {error&&<div className="en-alert" role="alert">{error}</div>}
        <section className="gx-banner ax-banner"><div>
          <span className="gx-kicker">CONNECTED SHL WORKFLOWS</span>
          <h2>A sharper view of the next seven days.</h2>
          <p>Overdue items remain visible until resolved. All dates are assessed in {feed.timezone}, with up to 100 entries per response.</p></div>
          <div className="gx-metric"><strong>{feed.items.length}</strong><small>VISIBLE ACTIONS</small></div>
        </section>
        <div className="ax-cards">
          {[
            {key:"OVERDUE",label:"Overdue",value:feed.overdue,note:"Needs immediate attention"},
            {key:"DUE_TODAY",label:"Due today",value:feed.dueToday,note:"Priority for the day"},
            {key:"UPCOMING",label:"Next 7 days",value:feed.upcoming,note:"Get ahead of work"}
          ].map(item=><button key={item.key} onClick={()=>setFilter(f=>f===item.key?"ALL":item.key)}
            className={"en-panel ax-card "+(filter===item.key?"ax-selected":"")}>
            <span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small>
          </button>)}
        </div>
        <section className="en-panel gx-list">
          <div className="gx-toolbar"><div><strong>Action queue</strong>
            <span>{filter==="ALL"?"All visible work":filter.replaceAll("_"," ")} · {filtered.length} entries</span></div>
            <button className="gx-open" onClick={()=>setFilter("ALL")}>Show all</button></div>
          <div className="ax-items">
            {loading&&<p className="gx-loading">Checking deadlines…</p>}
            {!loading&&filtered.length===0&&<p className="gx-loading">No alerts for this view. Your queue is clear.</p>}
            {filtered.map((a,i)=><Link key={a.source+"-"+a.reference+"-"+i} href={a.url} className="ax-item">
              <div className={"ax-icon ax-"+a.urgency.toLowerCase()}>{a.urgency==="OVERDUE"?"!":
                a.urgency==="DUE_TODAY"?"•":"↗"}</div>
              <div><strong>{a.title}</strong><p>{a.source} · {a.reference}</p></div>
              <div className="ax-item-date"><span>{a.dueDate}</span>
                <small>{a.urgency.replaceAll("_"," ")}</small></div>
              <span aria-hidden="true">→</span>
            </Link>)}
          </div>
        </section>
      </main>
    </div>
  </div>;
}
