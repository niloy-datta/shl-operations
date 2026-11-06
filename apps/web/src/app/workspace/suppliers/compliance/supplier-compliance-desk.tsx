"use client";
import { expireWorkspaceSession } from "@/lib/session-client";

import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";

type Supplier={id:string;name:string;country:string|null};
type Staff={role:string;username:string};
type Evidence={
  id:string;
  kind:string;
  document_reference:string;
  issued_on:string|null;
  expires_on:string|null;
  notes:string|null;
  submitted_by:string;
  decision:string|null;
  effective_status:string;
  review_reason:string|null;
  reviewed_by:string|null;
};
type Page<T>={content:T[];totalElements:number;totalPages:number};
const kinds=["TRADE_LICENSE","TAX_CERTIFICATE","EXPORT_LICENSE","QUALITY_CERTIFICATE","INSURANCE","OTHER"];

async function json<T>(path:string,init?:RequestInit):Promise<T>
{
  const response=await fetch(path,{cache:"no-store",...init});
  if (response.status===401)
  {
    expireWorkspaceSession();
    throw new Error("Session expired.");
  }
  if (!response.ok)
  {
    throw new Error("Request unsuccessful ("+response.status+"). Check role, input and review constraints.");
  }
  return response.json() as Promise<T>;
}

export function SupplierComplianceDesk()
{
  const [me,setMe]=useState<Staff|null>(null);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [selected,setSelected]=useState<Supplier|null>(null);
  const [search,setSearch]=useState("");
  const [records,setRecords]=useState<Page<Evidence>>({content:[],totalElements:0,totalPages:0});
  const [page,setPage]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [version,setVersion]=useState(0);
  const [recordsLoading,setRecordsLoading]=useState(false);

  const findSuppliers=useCallback(async(q:string)=>
  {
    const list=await json<Page<Supplier>>("/api/data/suppliers?"+
      new URLSearchParams({q,size:"100"}));
    setSuppliers(list.content);
  },[]);

  useEffect(()=>
  {
    let current=true;
    Promise.all([
      json<Staff>("/api/data/me"),
      json<Page<Supplier>>("/api/data/suppliers?size=100")
    ]).then(([user,result])=>
    {
      if(current)
      {
        setMe(user);
        setSuppliers(result.content);
      }
    }).catch(cause=>{if(current)setError(String(cause));})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[]);

  useEffect(()=>
  {
    if(!selected)return;
    let current=true;
    const frame=requestAnimationFrame(()=>setRecordsLoading(true));
    json<Page<Evidence>>("/api/supplier-compliance/suppliers/"+selected.id+
      "/evidence?"+new URLSearchParams({page:String(page),size:"20"}))
      .then(result=>{if(current){setRecords(result);setError("");}})
      .catch(cause=>{if(current)setError(String(cause));})
      .finally(()=>{cancelAnimationFrame(frame);if(current)setRecordsLoading(false);});
    return()=>{current=false;cancelAnimationFrame(frame);};
  },[selected,page,version]);

  const base=selected?"/api/supplier-compliance/suppliers/"+selected.id:"";

  async function submit(event:FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    if(!selected)return;
    const form=event.currentTarget;
    const data=new FormData(form);
    const read=(field:string)=>String(data.get(field)??"").trim();
    setBusy(true);setError("");setNotice("");
    try
    {
      await json(base+"/evidence",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          kind:read("kind"),documentReference:read("documentReference"),
          issuedOn:read("issuedOn")||null,expiresOn:read("expiresOn")||null,
          notes:read("notes")||null
        })
      });
      setPage(0);setVersion(x=>x+1);form.reset();
      setNotice("Reference submitted. An independent reviewer must assess it.");
    }
    catch(cause){setError(String(cause));}
    finally{setBusy(false);}
  }

  async function review(event:FormEvent<HTMLFormElement>,evidenceId:string)
  {
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const read=(field:string)=>String(data.get(field)??"").trim();
    setBusy(true);setError("");setNotice("");
    try
    {
      await json(base+"/evidence/"+evidenceId+"/review",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({decision:read("decision"),reviewReason:read("reviewReason")})
      });
      setVersion(x=>x+1);
      setNotice("Independent reference review recorded.");
    }
    catch(cause){setError(String(cause));}
    finally{setBusy(false);}
  }

  const canSubmit=["ADMIN","MANAGEMENT","SOURCING"].includes(me?.role??"");
  const canReview=["ADMIN","MANAGEMENT"].includes(me?.role??"");
  const canRead=["ADMIN","MANAGEMENT","SOURCING","BD"].includes(me?.role??"");

  return <main className="sc-page">
    <header className="sc-header">
      <Link href="/workspace" className="sc-back">← Operations workspace</Link>
      <h1>Supplier compliance review</h1>
      <p>Document references, independent decisions and expiry monitoring. No scanned documents are stored or automatically verified.</p>
    </header>
    {loading?<p>Loading suppliers…</p>:!canRead?<p role="alert">This account cannot access supplier compliance records.</p>:<>
      {error&&<p role="alert" className="sc-error">{error}</p>}
      {notice&&<p role="status" className="sc-notice">{notice}</p>}
      <section className="sc-card">
        <h2>Select an existing supplier</h2>
        <form onSubmit={event=>
        {
          event.preventDefault();
          void findSuppliers(search).catch(cause=>setError(String(cause)));
        }} className="sc-search">
          <input aria-label="Search suppliers" value={search} onChange={event=>setSearch(event.target.value)}
            placeholder="Search supplier name" maxLength={100}/>
          <button type="submit">Search</button>
        </form>
        <div className="sc-suppliers">
          {suppliers.map(supplier=><button key={supplier.id} type="button"
            aria-pressed={selected?.id===supplier.id}
            onClick={()=>{setSelected(supplier);setPage(0);setRecords({content:[],totalElements:0,totalPages:0});setError("");}}>
            {supplier.name}<small>{supplier.country??"Country not recorded"}</small>
          </button>)}
        </div>
      </section>
      {selected&&<section className="sc-card">
        <h2>{selected.name} · Submitted references</h2>
        <p>Approval confirms an internal staff review of the reference supplied. It does not certify legal authenticity or overall vendor eligibility.</p>
        {recordsLoading&&<p role="status">Loading submitted references…</p>}
        {!recordsLoading&&!error&&records.content.length===0&&<p>No reference recorded on this page.</p>}
        <div className="sc-evidence">
          {records.content.map(item=><article key={item.id}>
            <div className="sc-evidence-head"><h3>{item.kind.replaceAll("_"," ")}</h3>
              <strong>{item.effective_status}</strong></div>
            <p>Reference: {item.document_reference}</p>
            <p>Issued: {item.issued_on??"not specified"} · Expires: {item.expires_on??"not specified"}</p>
            {item.notes&&<p>Notes: {item.notes}</p>}
            <small>Submitted by {item.submitted_by}</small>
            {item.reviewed_by&&<p>Reviewed by {item.reviewed_by}: {item.review_reason}</p>}
            {canReview&&!item.decision&&item.submitted_by!==me?.username&&<form className="sc-review" onSubmit={event=>void review(event,item.id)}>
              <label>Review outcome
                <select name="decision" required>
                  <option value="REJECTED">Reject reference</option>
                  <option value="APPROVED">Approve reference</option>
                </select>
              </label>
              <label>Review evidence and reason
                <textarea name="reviewReason" required rows={2} maxLength={500}/>
              </label>
              <button disabled={busy} type="submit">Submit independent review</button>
            </form>}
          </article>)}
        </div>
        <div className="sc-pagination">
          <span>{records.totalElements} total reference(s)</span>
          <button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button>
          <button type="button" disabled={page+1>=records.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
        </div>
        {canSubmit&&<form className="sc-submit" onSubmit={submit}>
          <h3>Add a new document reference</h3>
          <div className="sc-two">
            <label>Document type
              <select name="kind" required>{kinds.map(kind=><option key={kind}>{kind}</option>)}</select>
            </label>
            <label>Reference / register number
              <input name="documentReference" required maxLength={180}/>
            </label>
            <label>Issued date
              <input name="issuedOn" type="date"/>
            </label>
            <label>Expiry date
              <input name="expiresOn" type="date"/>
            </label>
          </div>
          <label>Context (optional)
            <textarea name="notes" maxLength={500} rows={2}/>
          </label>
          <button type="submit" disabled={busy}>{busy?"Submitting…":"Submit for review"}</button>
        </form>}
      </section>}
    </>}
  </main>;
}
