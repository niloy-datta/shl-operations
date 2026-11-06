"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {WorkspaceNavigation} from "@/components/workspace-navigation";
import {useWorkspaceIdentity} from "@/components/workspace-identity";
import {EmptyState,FeedbackNotice} from "@/components/ui/primitives";

type Alert={source:string;reference:string;title:string;dueDate:string;urgency:string;url:string};
type Feed={items:Alert[];overdue:number;dueToday:number;upcoming:number;timezone:string};
export function AlertsDesk(){
  const router=useRouter();
  const {staff,commissionAccess}=useWorkspaceIdentity();
  const [feed,setFeed]=useState<Feed|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("ALL");
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/alerts",{cache:"no-store"});
      if(response.status===401){router.replace("/login");return;}
      if(response.status===403)throw new Error("Your account cannot access these alerts.");
      if(!response.ok)throw new Error("Unable to load operational alerts.");
      setFeed(await response.json() as Feed);setError("");
    }catch(e){setFeed(null);setError(e instanceof Error?e.message:"Unable to load alerts.");}
    finally{setLoading(false);}
  },[router]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{void load();});
    return()=>cancelAnimationFrame(frame);},[load]);
  const filtered=(feed?.items??[]).filter(x=>filter==="ALL"||x.urgency===filter);
  return <div className="en-app">
    <aside className="en-sidebar">
      <Link href="/workspace" className="en-brand"><span className="en-logo">S</span>
        <span><strong>SHL<span>.</span></strong><small>INTERNATIONAL</small></span></Link>
      <div className="en-edition"><span className="en-dot"/> OPERATIONS OS <span>LIVE</span></div>
      <div className="en-nav-scroll"><p className="en-nav-label">BUSINESS OPERATIONS</p>
        <WorkspaceNavigation role={staff?.role} commissionAccess={commissionAccess} />
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
        {error&&<FeedbackNotice message={error} action={<button type="button" onClick={()=>void load()}>Retry alerts</button>} />}
        <section className="gx-banner ax-banner"><div>
          <span className="gx-kicker">CONNECTED SHL WORKFLOWS</span>
          <h2>A sharper view of the next seven days.</h2>
          <p>Overdue items remain visible until resolved. All dates are assessed in {feed?.timezone??"UTC"}, with up to 100 entries per response.</p></div>
          <div className="gx-metric"><strong>{loading||!feed?"—":feed.items.length}</strong><small>VISIBLE ACTIONS</small></div>
        </section>
        <div className="ax-cards">
          {[
            {key:"OVERDUE",label:"Overdue",value:feed?.overdue,note:"Needs immediate attention"},
            {key:"DUE_TODAY",label:"Due today",value:feed?.dueToday,note:"Priority for the day"},
            {key:"UPCOMING",label:"Next 7 days",value:feed?.upcoming,note:"Get ahead of work"}
          ].map(item=><button key={item.key} onClick={()=>setFilter(f=>f===item.key?"ALL":item.key)}
            aria-pressed={filter===item.key}
            className={"en-panel ax-card "+(filter===item.key?"ax-selected":"")}>
            <span>{item.label}</span><strong>{loading||!feed?"—":item.value}</strong><small>{item.note}</small>
          </button>)}
        </div>
        <section className="en-panel gx-list">
          <div className="gx-toolbar"><div><strong>Action queue</strong>
            <span>{filter==="ALL"?"All visible work":filter.replaceAll("_"," ")} · {feed?filtered.length+" entries":"Awaiting live data"}</span></div>
            <button className="gx-open" onClick={()=>setFilter("ALL")}>Show all</button></div>
          <div className="ax-items" aria-busy={loading}>
            {loading&&<p className="gx-loading" role="status">Checking deadlines…</p>}
            {!loading&&!error&&feed&&filtered.length===0&&<div role="status"><EmptyState title="Your queue is clear" description="No alerts for this view." /></div>}
            {!loading&&filtered.map((a,i)=><Link key={a.source+"-"+a.reference+"-"+i} href={a.url} className="ax-item">
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
