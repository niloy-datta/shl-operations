"use client";

import {useEffect,useState} from "react";

type Lead={id:string;reference:string;company_name:string;subject:string;source:string};
type Queue={content:Lead[];totalElements:number};
type Staff={id:string;username:string;role:string;active_leads:number};
type Event={id:string;previous_owner_name:string|null;new_owner_name:string;
  assigned_by:string;reason:string;created_at:string};

async function requestJson<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,{cache:"no-store",...init});
  if(response.status===401){window.location.assign("/login");throw new Error("Please sign in again.");}
  if(!response.ok){
    if(response.status===403)throw new Error("Management permission is required.");
    if(response.status===404)throw new Error("Service not connected yet. Lead routing is unavailable.");
    if(response.status>=500)throw new Error("The routing service encountered a server error.");
    if(response.status===409)throw new Error("The routing queue changed. Refresh and retry.");
    if(response.status===400)throw new Error("Choose an active BD colleague and provide a reason.");
    throw new Error("Routing request failed ("+response.status+").");
  }
  try{return await response.json() as T;}catch{throw new Error("The routing service returned invalid JSON.");}
}
const root="/api/growth/leads/";

export function LeadRoutingPanel({onAssigned}:{onAssigned:()=>void}){
  const [queue,setQueue]=useState<Queue>({content:[],totalElements:0});
  const [staff,setStaff]=useState<Staff[]>([]);
  const [chosen,setChosen]=useState<Record<string,string>>({});
  const [reason,setReason]=useState("");
  const [epoch,setEpoch]=useState(0);
  const [loading,setLoading]=useState(true);
  const [queueReady,setQueueReady]=useState(false),[staffReady,setStaffReady]=useState(false);
  const [queueError,setQueueError]=useState(""),[staffError,setStaffError]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let alive=true;
    const controller=new AbortController();setLoading(true);setQueueReady(false);setStaffReady(false);setQueueError("");setStaffError("");
    Promise.allSettled([
      requestJson<Queue>(root+"queue?size=15",{signal:controller.signal}),
      requestJson<Staff[]>(root+"workload",{signal:controller.signal})
    ]).then(([q,owners])=>{
      if(!alive)return;
      if(q.status==="fulfilled"&&Array.isArray(q.value.content)&&typeof q.value.totalElements==="number"){setQueue(q.value);setQueueReady(true);}
      else setQueueError(q.status==="rejected"&&q.reason instanceof Error?q.reason.message:"The routing queue response is invalid.");
      if(owners.status==="fulfilled"&&Array.isArray(owners.value)){setStaff(owners.value);setStaffReady(true);}
      else setStaffError(owners.status==="rejected"&&owners.reason instanceof Error?owners.reason.message:"The staff workload response is invalid.");
    })
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;controller.abort();};
  },[epoch]);

  async function execute(path:string,payload?:object){
    setBusy(true);setError("");setNotice("");
    try{
      await requestJson<unknown>(path,{
        method:"POST",headers:{"content-type":"application/json"},
        body:payload?JSON.stringify(payload):undefined
      });
      setNotice("Ownership saved with an audit record.");
      setEpoch(n=>n+1);onAssigned();
    }catch(e){setError(e instanceof Error?e.message:"Could not assign lead.");}
    finally{setBusy(false);}
  }

  return <section className="en-panel lr-panel" aria-label="Lead assignment administration">
    <header className="lr-header">
      <div><p className="en-eyebrow">MANAGEMENT WORKFLOW / AUDITED</p>
        <h2>Ownership routing</h2>
        <p>Assign unclaimed leads to active business-development colleagues. No messages are sent.</p>
      </div>
      <div className="lr-header-actions">
        <strong>{queueReady&&!loading?queue.totalElements:"—"} waiting</strong>
        <button type="button" className="en-primary"
          disabled={busy||loading||!queueReady||!staffReady||queue.totalElements===0||staff.length===0}
          onClick={()=>void execute(root+"queue/assign-next")}>
          {busy?"Routing…":"Assign next · least loaded"}
        </button>
      </div>
    </header>
    {error&&<p role="alert" className="en-alert">{error}
      <button type="button" onClick={()=>{setLoading(true);setEpoch(n=>n+1);}}>Refresh</button></p>}
    {[queueError,staffError].filter(Boolean).map((issue,index)=><p key={index} role="alert" className="en-alert">{issue} <button type="button" onClick={()=>setEpoch(n=>n+1)}>Retry</button></p>)}
    {notice&&<p className="gx-notice" role="status">{notice}</p>}
    <div className="lr-workloads">
      {staffReady&&!loading&&staff.map(s=><span key={s.id}><strong>{s.username}</strong>
        <small>{Number(s.active_leads)} open</small></span>)}
      {!loading&&staffReady&&staff.length===0&&<p>No active BD staff accounts available.</p>}
    </div>
    <label className="lr-reason">
      <span>Reason for manual assignment (required)</span>
      <input type="text" maxLength={300} value={reason}
        placeholder="e.g. Customer territory agreed by manager"
        onChange={e=>setReason(e.target.value)}/>
    </label>
    <div className="lr-list">
      {queueReady&&!loading&&queue.content.map(lead=><div className="lr-lead" key={lead.id}>
        <div className="lr-lead-info"><strong>{lead.company_name}</strong>
          <small>{lead.reference} · {lead.subject} · {lead.source}</small></div>
        <select aria-label={"Assign "+lead.reference+" to"} disabled={!staffReady||busy}
          value={chosen[lead.id]??""}
          onChange={e=>setChosen(old=>({...old,[lead.id]:e.target.value}))}>
          <option value="">Choose BD owner</option>
          {staff.map(s=><option value={s.id} key={s.id}>{s.username} · {s.active_leads} open</option>)}
        </select>
        <button type="button" disabled={busy||!staffReady||!chosen[lead.id]||!reason.trim()}
          onClick={()=>void execute(root+lead.id+"/assign",{
            ownerId:chosen[lead.id],reason:reason.trim()
          })}>Assign</button>
      </div>)}
      {!loading&&queueReady&&queue.content.length===0&&<p className="en-help">
        No unassigned open leads. New leads will appear here until a manager assigns them.
      </p>}
      {loading&&<p className="en-help">Loading assignment queue…</p>}
    </div>
    {queue.totalElements>15&&<p className="en-help">Showing the oldest 15 leads. Assign or refresh to advance through the queue.</p>}
  </section>;
}

export function LeadAssignmentHistory({leadId}:{leadId:string}){
  const [events,setEvents]=useState<Event[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let alive=true;const controller=new AbortController();setLoading(true);setError("");setEvents([]);
    requestJson<Event[]>(root+leadId+"/assignments",{signal:controller.signal})
      .then(data=>{if(!Array.isArray(data))throw new Error("Ownership history returned invalid data.");if(alive)setEvents(data);})
      .catch(()=>{if(alive)setError("Ownership history is unavailable.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;controller.abort();};
  },[leadId]);

  return <section className="gx-notes lr-history">
    <h3>Ownership history</h3>
    {error&&<p className="en-help" role="alert">{error}</p>}
    {loading&&<p className="en-help" role="status">Loading ownership history…</p>}
    {!loading&&!error&&events.length===0&&<p className="en-help">No recorded ownership transfers since routing history was enabled.</p>}
    {!loading&&!error&&events.map(event=><article key={event.id}>
      <span>{event.previous_owner_name??"Unassigned"} → {event.new_owner_name}
        {" · "}{event.assigned_by}{" · "}{new Date(event.created_at).toLocaleString("en-GB")}</span>
      <p>{event.reason}</p>
    </article>)}
  </section>;
}
