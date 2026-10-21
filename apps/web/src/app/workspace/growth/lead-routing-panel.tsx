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
    if(response.status===409)throw new Error("The routing queue changed. Refresh and retry.");
    if(response.status===400)throw new Error("Choose an active BD colleague and provide a reason.");
    throw new Error("Routing request failed ("+response.status+").");
  }
  return response.json() as Promise<T>;
}
const root="/api/growth/leads/";

export function LeadRoutingPanel({onAssigned}:{onAssigned:()=>void}){
  const [queue,setQueue]=useState<Queue>({content:[],totalElements:0});
  const [staff,setStaff]=useState<Staff[]>([]);
  const [chosen,setChosen]=useState<Record<string,string>>({});
  const [reason,setReason]=useState("");
  const [epoch,setEpoch]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let alive=true;
    Promise.all([
      requestJson<Queue>(root+"queue?size=15"),
      requestJson<Staff[]>(root+"workload")
    ]).then(([q,owners])=>{
      if(alive){setQueue(q);setStaff(owners);setError("");}
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Could not load queue.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
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
        <strong>{queue.totalElements} waiting</strong>
        <button type="button" className="en-primary"
          disabled={busy||loading||queue.totalElements===0||staff.length===0}
          onClick={()=>void execute(root+"queue/assign-next")}>
          {busy?"Routing…":"Assign next · least loaded"}
        </button>
      </div>
    </header>
    {error&&<p role="alert" className="en-alert">{error}
      <button type="button" onClick={()=>{setLoading(true);setEpoch(n=>n+1);}}>Refresh</button></p>}
    {notice&&<p className="gx-notice" role="status">{notice}</p>}
    <div className="lr-workloads">
      {staff.map(s=><span key={s.id}><strong>{s.username}</strong>
        <small>{Number(s.active_leads)} open</small></span>)}
      {!loading&&staff.length===0&&<p>No active BD staff accounts available.</p>}
    </div>
    <label className="lr-reason">
      <span>Reason for manual assignment (required)</span>
      <input type="text" maxLength={300} value={reason}
        placeholder="e.g. Customer territory agreed by manager"
        onChange={e=>setReason(e.target.value)}/>
    </label>
    <div className="lr-list">
      {queue.content.map(lead=><div className="lr-lead" key={lead.id}>
        <div className="lr-lead-info"><strong>{lead.company_name}</strong>
          <small>{lead.reference} · {lead.subject} · {lead.source}</small></div>
        <select aria-label={"Assign "+lead.reference+" to"}
          value={chosen[lead.id]??""}
          onChange={e=>setChosen(old=>({...old,[lead.id]:e.target.value}))}>
          <option value="">Choose BD owner</option>
          {staff.map(s=><option value={s.id} key={s.id}>{s.username} · {s.active_leads} open</option>)}
        </select>
        <button type="button" disabled={busy||!chosen[lead.id]||!reason.trim()}
          onClick={()=>void execute(root+lead.id+"/assign",{
            ownerId:chosen[lead.id],reason:reason.trim()
          })}>Assign</button>
      </div>)}
      {!loading&&queue.content.length===0&&<p className="en-help">
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
  useEffect(()=>{
    let alive=true;
    requestJson<Event[]>(root+leadId+"/assignments")
      .then(data=>{if(alive){setEvents(data);setError("");}})
      .catch(()=>{if(alive)setError("Ownership history is unavailable.");});
    return()=>{alive=false;};
  },[leadId]);

  return <section className="gx-notes lr-history">
    <h3>Ownership history</h3>
    {error&&<p className="en-help" role="alert">{error}</p>}
    {!error&&events.length===0&&<p className="en-help">No recorded ownership transfers since routing history was enabled.</p>}
    {events.map(event=><article key={event.id}>
      <span>{event.previous_owner_name??"Unassigned"} → {event.new_owner_name}
        {" · "}{event.assigned_by}{" · "}{new Date(event.created_at).toLocaleString("en-GB")}</span>
      <p>{event.reason}</p>
    </article>)}
  </section>;
}
