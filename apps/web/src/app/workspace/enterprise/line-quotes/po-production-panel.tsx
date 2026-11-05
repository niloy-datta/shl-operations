"use client";

import {useState,type FormEvent} from "react";

type Milestone={
  id:string;
  kind:string;
  status:string;
  target_date:string;
  notes:string;
  created_by:string;
  completed_by:string|null;
};
type Event={id:string;event:string;note:string;actor:string;created_at:string};
const kinds=["PRODUCTION_START","FACTORY_READY","QUALITY_CHECK"];

export function PoProductionPanel({poId,role}:{poId:string;role:string})
{
  const [expanded,setExpanded]=useState(false);
  const [items,setItems]=useState<Milestone[]>([]);
  const [history,setHistory]=useState<Record<string,Event[]>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const path="/api/enterprise/commerce/line-orders/purchase-orders/"+poId+"/production";

  async function request<T>(endpoint:string,init?:RequestInit):Promise<T>
  {
    const response=await fetch(endpoint,{cache:"no-store",...init});
    if(response.status===401)
    {
      window.location.assign("/login");
      throw new Error("Session expired");
    }
    if(!response.ok)
    {
      throw new Error("Factory milestone request rejected ("+response.status+"). Review status and permissions.");
    }
    return response.json() as Promise<T>;
  }

  async function refresh()
  {
    setItems(await request<Milestone[]>(path));
  }

  async function open()
  {
    setExpanded(x=>!x);
    if(!expanded)
    {
      setBusy(true);setError("");
      try{await refresh();}
      catch(cause){setError(String(cause));}
      finally{setBusy(false);}
    }
  }

  async function submit(event:FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    const read=(key:string)=>String(data.get(key)??"").trim();
    setBusy(true);setError("");setNotice("");
    try
    {
      await request<Milestone>(path,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          kind:read("kind"),targetDate:read("targetDate"),notes:read("notes")
        })
      });
      await refresh();
      form.reset();
      setNotice("Factory milestone recorded.");
    }
    catch(cause){setError(String(cause));}
    finally{setBusy(false);}
  }

  async function update(event:FormEvent<HTMLFormElement>,item:Milestone)
  {
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    setBusy(true);setError("");setNotice("");
    try
    {
      await request<Milestone>(path+"/"+item.id+"/status",{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          status:String(data.get("status")??""),
          note:String(data.get("note")??"").trim()
        })
      });
      await refresh();
      setNotice("Updated and recorded in milestone history.");
    }
    catch(cause){setError(String(cause));}
    finally{setBusy(false);}
  }

  async function showEvents(id:string)
  {
    try
    {
      const events=await request<Event[]>(path+"/"+id+"/events");
      setHistory(prev=>({...prev,[id]:events}));
    }
    catch(cause){setError(String(cause));}
  }

  const next:Record<string,string[]>={
    PLANNED:["IN_PROGRESS","BLOCKED"],
    IN_PROGRESS:["COMPLETED","BLOCKED"],
    BLOCKED:["IN_PROGRESS"],
    COMPLETED:[]
  };
  const existing=new Set(items.map(x=>x.kind));
  const canWrite=["ADMIN","MANAGEMENT","SOURCING"].includes(role);
  const canReviewQuality=["ADMIN","MANAGEMENT"].includes(role);

  return <section className="pm-panel" aria-label="Supplier production milestones">
    <button type="button" onClick={()=>void open()} disabled={busy}>
      {expanded?"Hide factory milestones":"View factory milestones"}
    </button>
    {expanded&&<div className="pm-content">
      <p>Staff-reported progress only. A completed quality check does not certify an external factory inspection.</p>
      {error&&<p role="alert" className="pm-error">{error}</p>}
      {notice&&<p role="status" className="pm-notice">{notice}</p>}
      {items.map(item=><article key={item.id}>
        <strong>{item.kind.replaceAll("_"," ")} · {item.status}</strong>
        <small>Target {item.target_date} · Created by {item.created_by}</small>
        <p>{item.notes}</p>
        {item.completed_by&&<p>Completed by {item.completed_by}</p>}
        <button type="button" disabled={busy} onClick={()=>void showEvents(item.id)}>View history</button>
        {history[item.id]&&<ol>{history[item.id].map(entry=><li key={entry.id}>
          {entry.event} · {entry.actor} · {new Date(entry.created_at).toLocaleString("en-GB")}
          <p>{entry.note}</p>
        </li>)}</ol>}
        {canWrite&&item.status!=="COMPLETED"&&
          <form onSubmit={event=>void update(event,item)}>
            <label>Next status
              <select name="status" required>
                {next[item.status].filter(status=>status!=="COMPLETED"||
                  item.kind!=="QUALITY_CHECK"||canReviewQuality).map(status=>
                    <option value={status} key={status}>{status.replaceAll("_"," ")}</option>)}
              </select>
            </label>
            <label>Observed evidence / progress note
              <textarea name="note" required maxLength={500} rows={2}/>
            </label>
            <button type="submit" disabled={busy}>Save status</button>
          </form>}
      </article>)}
      {canWrite&&existing.size<3&&<form onSubmit={submit} className="pm-create">
        <h4>Register a factory milestone</h4>
        <label>Milestone kind
          <select name="kind" required>
            {kinds.filter(kind=>!existing.has(kind)).map(kind=>
              <option value={kind} key={kind}>{kind.replaceAll("_"," ")}</option>)}
          </select>
        </label>
        <label>Planned target date
          <input name="targetDate" type="date" required/>
        </label>
        <label>Internal milestone evidence
          <textarea name="notes" maxLength={500} rows={2} required/>
        </label>
        <button type="submit" disabled={busy}>Create milestone</button>
      </form>}
    </div>}
  </section>;
}
