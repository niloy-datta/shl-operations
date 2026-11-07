"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {ArrowUpRight,ArrowRight,RefreshCw,CheckCheck,CalendarDays,Clock3,ClipboardCheck,Ship,Inbox,AlertTriangle,Search,Activity,UsersRound,ListTodo,FileStack,ShieldCheck,Truck,Timer} from "lucide-react";
import {useWorkspaceIdentity} from "./workspace-identity";
import {expireWorkspaceSession} from "@/lib/session-client";
type Item={id:string;reference:string;title:string;context:string;status:string;owner:string;dueDate:string|null;url:string;stage:string};
type Alert={source:string;reference:string;title:string;dueDate:string;urgency:string;url:string};
type Overview={asOfUtc:string;scope:string;metrics:{key:string;label:string;value:number;href:string}[];priorities:Item[];approvals:Item[];shipments:Item[];pipeline:{key:string;label:string;count:number;href:string}[];alerts:{items:Alert[];overdue:number;dueToday:number;upcoming:number};orders?:Item[];activity?:Item[];workload?:{username:string;open_tasks:number}[]};
const day=(value:string|null)=>value?new Date(value.slice(0,10)+"T12:00:00Z").toLocaleDateString("en-GB",{day:"2-digit",month:"short",timeZone:"UTC"}):"Not scheduled";
export function NexusOverview({executive=false}:{executive?:boolean}){
 const {staff}=useWorkspaceIdentity();const [data,setData]=useState<Overview|null>(null),[error,setError]=useState("");
 const [loading,setLoading]=useState(true),[tick,setTick]=useState(0),[query,setQuery]=useState("");
 const [period,setPeriod]=useState("ALL"),[stage,setStage]=useState("all"),[expanded,setExpanded]=useState(false);
 const refresh=useCallback(()=>{setLoading(true);setTick(v=>v+1);},[]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/workspace-overview?scope="+(executive?"team":"personal"),{cache:"no-store",signal:controller.signal}).then(async r=>{
   if(r.status===401){expireWorkspaceSession();return;}
   if(r.status===403)throw new Error("This overview requires management access. Your permitted workspaces remain available in the sidebar.");
   if(!r.ok)throw new Error("Workspace data is unavailable. Please retry.");
   const result=await r.json() as Overview;if(!controller.signal.aborted){setData(result);setError("");}
  }).catch(e=>{if(!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:"Workspace unavailable");}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[executive,tick]);
 const items=useMemo(()=>data?.priorities.filter(item=>{
  const text=[item.reference,item.title,item.context,item.owner].join(" ").toLowerCase();
  return text.includes(query.toLowerCase())&&(stage==="all"||item.stage===stage)&&
   (period==="ALL"||!!item.dueDate&&(period==="TODAY"?item.dueDate===data.asOfUtc:item.dueDate<data.asOfUtc));
 })||[],[data,query,period,stage]);
 const alerts=data?.alerts.items.filter(item=>period==="ALL"||(period==="TODAY"?item.dueDate===data.asOfUtc:item.dueDate<data.asOfUtc))||[];
 const executiveMetrics=useMemo(()=>{
  const source=data?.metrics||[];
  if(!executive||!data)return source;
  const shipment=data.pipeline.find(item=>item.key==="shipment");
  return [...source,...(shipment?[{key:"shipments",label:"Active line shipments",value:shipment.count,href:shipment.href}]:[]),
   {key:"overdue",label:"Overdue alerts · feed",value:data.alerts.overdue,href:"/workspace/alerts"}].slice(0,6);
 },[data,executive]);
 const metricCards: {key:string;label:string;value:number|null;href:string}[]=executive
  ?(data?executiveMetrics:Array.from({length:6},(_,i)=>({key:"loading-"+i,label:"Loading metric",value:null,href:""})))
  :(data?.metrics||Array.from({length:4},(_,i)=>({key:String(i),label:loading?"Loading metric":"Metric unavailable",value:null,href:""})));
 const greeting=()=>{const hour=new Date().getHours();return hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";};
 const metricIcon:Record<string,typeof Activity>={tasks:ListTodo,inquiries:UsersRound,rfqs:FileStack,approvals:ShieldCheck,shipments:Truck,overdue:Timer};
 return <main className={"nx-overview"+(executive?" nx-executive":"")}>
  <div className="nx-page-heading"><div><p className="nx-eyebrow"><span/> {executive?"EXECUTIVE OVERVIEW":"YOUR WORK, CONNECTED"}</p><h1>{executive?`${greeting()}, ${staff?.username||"team"}`:"Your day, in focus."}</h1><p>{executive?"Your operations, one clear view. Focus on decisions, owners and the next handoff.":`Welcome back${staff?", "+staff.username:""}. Here is where your attention matters.`}</p></div>
   <div className="nx-heading-actions"><label className="nx-context"><CalendarDays size={15}/><select aria-label="Work date filter" value={period} onChange={e=>setPeriod(e.target.value)}><option value="ALL">All current work</option><option value="TODAY">Due today</option><option value="OVERDUE">Overdue</option></select></label><button className="nx-button nx-secondary" disabled={loading} onClick={refresh}><RefreshCw size={15} className={loading?"nx-spin":""}/> Refresh</button></div></div>
  <div className="nx-context-line"><span><i/>{loading?"Updating workspace…":data?"Team snapshot · "+new Date(data.asOfUtc+"T12:00:00Z").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}):"Awaiting live data"}</span><span>{executive?"Management scope · Source-backed counts · No financial projection":"Personal tasks & leads · Filters: priorities & alerts"}</span></div>
  {error&&<div className="nx-error" role="alert"><AlertTriangle size={18}/><span>{error}</span><button onClick={refresh}>Retry overview</button></div>}
  <section className="nx-kpis" aria-label="Operational metrics">{metricCards.map(metric=>{const Icon=metricIcon[metric.key]||Activity;return metric.href?<Link className="nx-kpi" href={metric.href} key={metric.key}><div className="nx-kpi-top"><span className="nx-kpi-icon"><Icon size={17}/></span><ArrowUpRight size={15}/></div><span className="nx-kpi-label">{metric.label}</span><strong>{loading?"—":metric.value?.toLocaleString()}</strong><small>{metric.key==="overdue"?"From the current alert feed":"Open source workspace"}</small></Link>:<div className="nx-kpi" key={metric.key} aria-busy={loading}><span>{metric.label}</span><strong>—</strong><small>{loading?"Loading authorized count":"Awaiting authorized data"}</small></div>})}</section>
  <div className="nx-desk-grid">
   <section className="nx-panel nx-priority"><div className="nx-panel-head"><div><p className="nx-eyebrow">OPERATIONAL PRIORITY DESK</p><h2>{executive?"What needs a decision":"What needs your attention"}</h2></div><span className="nx-count">{loading?"—":Math.min(items.length,expanded?items.length:5)} shown</span></div>
    <div className="nx-list-tools"><label><Search size={15}/><input aria-label="Search priority records" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Reference, company or owner…"/></label><select aria-label="Priority record type" value={stage} onChange={e=>setStage(e.target.value)}><option value="all">All work</option><option value="tasks">Tasks</option><option value="inquiry">Leads</option><option value="rfq">RFQs</option></select></div>
    {loading?<div className="nx-empty" role="status">Loading priority records…</div>:!data?<Empty title="Priority data unavailable" text="Retry the overview to see current work."/>:items.length===0?<Empty title={query||period!=="ALL"||stage!=="all"?"No matching priorities":"Room to move work forward"} text="No matching records in this bounded snapshot. Open a source workspace to review all records."/>:executive?<div className="nx-priority-scroll"><table className="nx-priority-table"><thead><tr><th>Business matter</th><th>Type</th><th>Company / context</th><th>Owner</th><th>Due</th></tr></thead><tbody>{items.slice(0,expanded?items.length:5).map(item=><tr key={item.stage+item.id}><td><Link href={item.url}><strong>{item.title}</strong><small>{item.reference}</small></Link></td><td><span className="nx-status">{item.stage.replaceAll("_"," ")}</span></td><td>{item.context}</td><td>{item.owner}</td><td className={item.dueDate&&item.dueDate<data.asOfUtc?"nx-is-late":""}>{day(item.dueDate)}{item.dueDate&&item.dueDate<data.asOfUtc&&<b className="nx-due-tag">Overdue</b>}</td></tr>)}</tbody></table></div>:<div className="nx-work-list">{items.slice(0,expanded?items.length:5).map(item=><Link key={item.stage+item.id} href={item.url} className="nx-work-item"><span className={"nx-record-icon "+(item.dueDate&&item.dueDate<data.asOfUtc?"nx-is-late":"")}><ClipboardCheck size={18}/></span><div className="nx-work-copy"><small>{item.reference.length>25?item.reference.slice(0,12):item.reference} · {item.context}</small><strong>{item.title}</strong><span>{item.owner} <i/> {day(item.dueDate)}{item.dueDate&&data&&item.dueDate<data.asOfUtc&&<b className="nx-due-tag">Overdue</b>}</span></div><span className="nx-status">{item.status.replaceAll("_"," ")}</span><ArrowUpRight size={16}/></Link>)}</div>}
    {items.length>5&&<button className="nx-expand" onClick={()=>setExpanded(!expanded)}>{expanded?"Show fewer priorities":"Show all "+items.length+" snapshot records"}<ArrowRight size={14}/></button>}
    <div className="nx-panel-foot"><Clock3 size={13}/> Ordered by due date · Up to 16 priority records, not the full company queue</div>
   </section>
   <aside className="nx-action-center"><section className="nx-panel"><div className="nx-panel-head"><div><p className="nx-eyebrow">ACTION CENTER</p><h2>Keep the next step moving</h2></div><Inbox size={20}/></div><div className="nx-action-summary"><Link href="/workspace/alerts"><span className="nx-dot nx-red"/> Overdue alerts <strong>{data?data.alerts.overdue:"—"}</strong><ArrowUpRight size={14}/></Link><Link href="/workspace/alerts"><span className="nx-dot nx-amber"/> Due today <strong>{data?data.alerts.dueToday:"—"}</strong><ArrowUpRight size={14}/></Link></div>
    {data&&data.approvals.length>0&&<div className="nx-approval-list"><h3>Independent reviews</h3>{data.approvals.map(item=><Link key={item.id} href={item.url}><ClipboardCheck size={16}/><div><strong>{item.title}</strong><small>{item.context} · {item.owner}</small></div><ArrowUpRight size={14}/></Link>)}</div>}
    <div className="nx-alert-list">{alerts.slice(0,4).map((item,i)=><Link href={item.url} key={item.source+item.reference+i}><span className={"nx-dot "+(item.urgency==="OVERDUE"?"nx-red":"nx-amber")}/><div><strong>{item.title}</strong><small>{item.reference} · {day(item.dueDate)}</small></div><ArrowUpRight size={14}/></Link>)}</div>
    {data&&alerts.length===0&&<p className="nx-quiet">No matching due-date alerts in the next-seven-day feed.</p>}<Link className="nx-panel-link" href="/workspace/alerts">Review operational alerts <ArrowRight size={15}/></Link></section>
    <div className="nx-note"><CheckCheck size={18}/><div><strong>Every handoff, accountable.</strong><p>Approvals stay independent. Financial and commission access stays restricted.</p></div></div>
   </aside>
  </div>
  <section className="nx-panel nx-pipeline"><div className="nx-panel-head"><div><p className="nx-eyebrow">CONNECTED TRADING PIPELINE</p><h2>From the first inquiry to the next handoff</h2></div><span className="nx-muted">Authorized stages only</span></div><div className="nx-stage-list">{data?.pipeline.map((item,i)=><Link key={item.key} href={item.href}><small>{String(i+1).padStart(2,"0")}</small><strong>{item.count.toLocaleString()}</strong><span>{item.label}</span><ArrowUpRight size={14}/></Link>)}</div>{data?.pipeline.length===0&&<p className="nx-quiet">Your role has no trading stages in this view.</p>}</section>
  <div className="nx-bottom-grid">
   <section className="nx-panel"><div className="nx-panel-head"><div><p className="nx-eyebrow">ORDER EXECUTION</p><h2>Latest line orders</h2></div></div>{data?.orders?.length?<div className="nx-work-list">{data.orders.slice(0,4).map(item=><Link href={item.url} className="nx-work-item" key={item.id}><div className="nx-work-copy"><small>{item.reference} · {item.context}</small><strong>{item.title}</strong><span>{item.owner}</span></div><span className="nx-status">{item.status}</span><ArrowUpRight size={15}/></Link>)}</div>:<Empty title={!data?(loading?"Loading line orders…":"Order data unavailable"):"No line orders in this view"} text="Permitted draft and confirmed orders appear here. Legacy order records remain in their existing desk."/>}</section>
   <section className="nx-panel"><div className="nx-panel-head"><div><p className="nx-eyebrow">ACCOUNTABLE WORK</p><h2>{executive?"Team workload":"Recent task updates"}</h2></div></div>{executive&&data?.workload?.length?<div className="nx-work-list">{data.workload.map(row=><Link href="/workspace/enterprise/tasks" className="nx-work-item" key={row.username}><div className="nx-work-copy"><strong>{row.username}</strong><span>Open assigned tasks</span></div><span className="nx-count">{row.open_tasks}</span></Link>)}</div>:data?.activity?.length?<div className="nx-work-list">{data.activity.map(item=><Link href={item.url} key={item.id} className="nx-work-item"><div className="nx-work-copy"><strong>{item.title}</strong><span>{item.owner} · Updated {day(item.dueDate)}</span></div><span className="nx-status">{item.status}</span></Link>)}</div>:<Empty title={!data?(loading?"Loading task updates…":"Task data unavailable"):"No task updates to show"} text="Assignment and progress updates appear after tasks are recorded."/>}</section>
  </div>
  <section className="nx-panel nx-shipment-watch"><div className="nx-panel-head"><div><p className="nx-eyebrow">SHIPMENT WATCH</p><h2>The next arrival matters</h2></div><Ship size={20}/></div>{data?.shipments.length?<div className="nx-work-list">{data.shipments.map(item=><Link key={item.id} href={item.url} className="nx-work-item"><Ship size={20}/><div className="nx-work-copy"><small>{item.reference} · {item.context}</small><strong>{item.title}</strong><span>ETA {day(item.dueDate)} · Staff-reported status</span></div><span className="nx-status">{item.status.replaceAll("_"," ")}</span><ArrowUpRight size={16}/></Link>)}</div>:<Empty title={loading?"Loading shipment watch…":!data?"Shipment data unavailable":"No active shipments in this view"} text="Authorized booked and in-transit line shipments appear here. Carrier feeds and verified delivery are not connected."/>}</section>
 </main>;
}
function Empty({title,text}:{title:string;text:string}){return <div className="nx-empty"><Inbox size={28}/><strong>{title}</strong><p>{text}</p></div>;}
