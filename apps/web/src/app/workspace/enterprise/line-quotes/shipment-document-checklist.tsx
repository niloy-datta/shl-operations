"use client";

import {useEffect,useState,type FormEvent} from "react";

type Item={kind:string;label:string;status:"MISSING"|"REQUESTED"|"REPORTED_RECEIVED";
  documentReference:string|null;note:string|null;updatedBy:string|null;updatedAt:string|null};
type Status=Item["status"];
const base="/api/enterprise/logistics/line-shipments/";
const statusLabels:Record<Status,string>={
  MISSING:"Missing",REQUESTED:"Requested",REPORTED_RECEIVED:"Reported received · unverified"
};

export function ShipmentDocumentChecklist({shipmentId,canWrite}:{
  shipmentId:string;canWrite:boolean
}){
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const [editing,setEditing]=useState<string|null>(null);
  const [status,setStatus]=useState<Status>("REQUESTED");
  const [documentReference,setDocumentReference]=useState("");
  const [note,setNote]=useState("");
  useEffect(()=>{
    let active=true;
    fetch(base+shipmentId+"/documents",{cache:"no-store"})
      .then(async response=>{
        if(response.status===401){window.location.assign("/login");return null;}
        if(!response.ok)throw new Error("Unable to read document checklist ("+response.status+").");
        return response.json() as Promise<Item[]>;
      }).then(data=>{if(active&&data){setItems(data);setError("");}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load checklist");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[shipmentId,revision]);
  const reported=items.filter(item=>item.status==="REPORTED_RECEIVED").length;
  function edit(item:Item){
    setEditing(item.kind);setStatus(item.status);setDocumentReference(item.documentReference||"");
    setNote(item.note||"");setError("");
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!editing||busy)return;
    if(status==="REPORTED_RECEIVED"&&!documentReference.trim()){
      setError("Enter an internal reference for the reported document.");return;
    }
    setBusy(true);setError("");
    try{
      const response=await fetch(base+shipmentId+"/documents/"+editing,{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({status,documentReference:status==="REPORTED_RECEIVED"?
          documentReference.trim():null,note:note.trim()||null})
      });
      if(response.status===401){window.location.assign("/login");return;}
      if(!response.ok){
        const body=await response.json().catch(()=>({})) as {detail?:string};
        throw new Error(body.detail||"Document update rejected ("+response.status+").");
      }
      setEditing(null);setRevision(value=>value+1);
    }catch(e){setError(e instanceof Error?e.message:"Unable to update document");}
    finally{setBusy(false);}
  }
  return <section className="lo-docs" aria-label="Shipment document checklist">
    <div className="lo-docs-head">
      <div><h4>Shipping document checklist</h4>
        <p>Manual tracking only. No uploaded files or independently verified evidence.</p></div>
      <span>{reported} / {items.length} reported received</span>
    </div>
    {error&&<p role="alert" className="lq-error">{error}</p>}
    {loading?<p className="lq-muted">Loading document requirements…</p>:
      <div className="lo-docs-grid">{items.map(item=>
        <div className="lo-doc" key={item.kind}>
          <div className="lo-doc-top"><strong>{item.label}</strong>
            <span className={"lo-doc-status lo-doc-"+item.status.toLowerCase()}>
              {statusLabels[item.status]}</span></div>
          {item.documentReference&&<p>Internal ref: {item.documentReference}</p>}
          {item.note&&<p>Note: {item.note}</p>}
          {item.updatedBy&&<small>Updated by {item.updatedBy}
            {item.updatedAt?" · "+new Date(item.updatedAt).toLocaleString("en-GB"):""}</small>}
          {canWrite&&<button type="button" disabled={busy}
            onClick={()=>edit(item)} aria-expanded={editing===item.kind}>
            Update status
          </button>}
          {canWrite&&editing===item.kind&&<form onSubmit={save} className="lo-doc-form">
            <label>Status<select value={status} disabled={busy}
              onChange={event=>setStatus(event.target.value as Status)}>
              {Object.entries(statusLabels).map(([value,label])=>
                <option key={value} value={value}>{label}</option>)}
            </select></label>
            {status==="REPORTED_RECEIVED"&&
              <label>Document reference *<input value={documentReference}
                maxLength={120} required disabled={busy}
                onChange={event=>setDocumentReference(event.target.value)}
                placeholder="Internal reference, not a URL"/></label>}
            <label>Note / correction reason<input value={note} maxLength={300}
              disabled={busy} onChange={event=>setNote(event.target.value)}/></label>
            <div><button type="submit" disabled={busy}>Save change</button>
              <button type="button" disabled={busy} onClick={()=>setEditing(null)}>
                Cancel</button></div>
          </form>}
        </div>)}</div>}
  </section>;
}
