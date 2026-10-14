"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Page<T> = { content: T[]; totalElements: number; totalPages: number };
type Consignee = {
  id: string; code: string; customer_id: string; customer_name: string;
  company_name: string; contact_name: string | null; email: string | null;
  phone: string | null; country_code: string; address: string; active: boolean;
};
type Customer = { id: string; name: string };
type Shipment = {
  id: string; reference: string; customer_id: string; status: string;
  consignee_id: string | null; consignee_name: string | null;
};
type Draft = {
  customerId: string; companyName: string; contactName: string; email: string;
  phone: string; countryCode: string; address: string; active: boolean;
};
const empty: Draft = {
  customerId:"", companyName:"", contactName:"", email:"", phone:"",
  countryCode:"", address:"", active:true
};
const apiRoot = "/api/enterprise/";
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path.startsWith("/")?path:apiRoot+path,
    {cache:"no-store",...options});
  if (response.status===401) { window.location.assign("/login"); throw new Error("Session expired"); }
  if (!response.ok) {
    const body=await response.json().catch(()=>null);
    throw new Error(response.status===403?"Permission denied":
      response.status===409?"Conflicting customer or shipment state":
      typeof body?.error==="string"?body.error:"Request failed ("+response.status+")");
  }
  return response.json() as Promise<T>;
}
function write<T>(path:string, method:"POST"|"PATCH",body:object) {
  return request<T>(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
}
export function ConsigneeWorkspace() {
  const [rows,setRows]=useState<Page<Consignee>>({content:[],totalElements:0,totalPages:0});
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [shipments,setShipments]=useState<Shipment[]>([]);
  const [query,setQuery]=useState("");
  const [term,setTerm]=useState("");
  const [page,setPage]=useState(0);
  const [tick,setTick]=useState(0);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [draft,setDraft]=useState<Draft>(empty);
  const [shipping,setShipping]=useState<Shipment|null>(null);
  const [recipient,setRecipient]=useState("");
  const [recipientQuery,setRecipientQuery]=useState("");
  const [recipientTerm,setRecipientTerm]=useState("");
  const [recipientPage,setRecipientPage]=useState(0);
  const [matching,setMatching]=useState<Page<Consignee>>({content:[],totalElements:0,totalPages:0});
  const refresh=useCallback(()=>setTick(value=>value+1),[]);

  useEffect(()=>{
    let live=true;
    const q=new URLSearchParams({page:String(page),size:"15",q:term});
    Promise.all([
      request<Page<Consignee>>("logistics/consignees?"+q),
      request<Page<Customer>>("/api/data/customers?page=0&size=100"),
      request<Page<Shipment>>("logistics/shipments?page=0&size=100")
    ]).then(([consignees,buyers,activeShipments])=>{
      if(!live)return;
      setRows(consignees);setCustomers(buyers.content);setShipments(activeShipments.content);
      setError("");
    }).catch(err=>{if(live)setError(err instanceof Error?err.message:"Unable to load records");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[page,term,tick]);

  useEffect(()=>{
    if(!shipping)return;
    let live=true;
    const params=new URLSearchParams({customerId:shipping.customer_id,
      page:String(recipientPage),size:"20",q:recipientTerm});
    request<Page<Consignee>>("logistics/consignees?"+params)
      .then(result=>{if(live)setMatching(result);})
      .catch(err=>{if(live)setError(err instanceof Error?err.message:"Unable to find recipients");});
    return()=>{live=false;};
  },[shipping,recipientPage,recipientTerm]);

  function openShipment(shipment:Shipment) {
    setShipping(shipment);setRecipient("");setRecipientQuery("");setRecipientTerm("");
    setRecipientPage(0);setMatching({content:[],totalElements:0,totalPages:0});
    setError("");
  }
  function startNew() {
    setDraft({...empty});setEditing(null);setShowForm(true);setError("");
  }
  function startEdit(row:Consignee) {
    setDraft({customerId:row.customer_id,companyName:row.company_name,
      contactName:row.contact_name??"",email:row.email??"",phone:row.phone??"",
      countryCode:row.country_code.trim(),address:row.address,active:row.active});
    setEditing(row.id);setShowForm(true);setError("");
  }
  const field=(key:keyof Draft,value:string|boolean)=>
    setDraft(current=>({...current,[key]:value}));
  async function save(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setSaving(true);setError("");setNotice("");
    const payload={...draft,companyName:draft.companyName.trim(),
      contactName:draft.contactName.trim()||null,email:draft.email.trim()||null,
      phone:draft.phone.trim()||null,countryCode:draft.countryCode.trim().toUpperCase(),
      address:draft.address.trim()};
    try {
      if(editing)await write<Consignee>("logistics/consignees/"+editing,"PATCH",payload);
      else await write<Consignee>("logistics/consignees","POST",payload);
      setShowForm(false);setNotice(editing?"Consignee updated.":"Consignee added.");
      setPage(0);refresh();
    }catch(err){setError(err instanceof Error?err.message:"Unable to save consignee");}
    finally{setSaving(false);}
  }
  async function assign(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!shipping||!recipient)return;
    setSaving(true);setError("");setNotice("");
    try {
      await write<Shipment>("logistics/shipments/"+shipping.id+"/consignee","PATCH",
        {consigneeId:recipient});
      setShipping(null);setRecipient("");setNotice("Shipment recipient assigned.");refresh();
    }catch(err){setError(err instanceof Error?err.message:"Unable to assign recipient");}
    finally{setSaving(false);}
  }
  const shipmentsReady=shipments.filter(s=>s.status==="BOOKED");

  return <main className="cn-shell">
    <div className="cn-top">
      <Link className="cn-back" href="/workspace">← Operations dashboard</Link>
      <div className="cn-top-actions">
        <Link href="/workspace/enterprise/shipments">Shipments ↗</Link>
        <button onClick={refresh} type="button">Refresh</button>
      </div>
    </div>
    <section className="cn-hero">
      <p className="cn-eyebrow">SHL INTERNATIONAL · LOGISTICS CONTROL</p>
      <h1>Consignee <span>directory.</span></h1>
      <p>Manage verified receiving parties by customer and link them to shipments before departure.
        Every change is validated and audit-logged.</p>
      <div className="cn-hero-actions">
        <button onClick={startNew} className="cn-primary">+ Add consignee</button>
        <span>Customer-scoped · Authenticated · Audited</span>
      </div>
    </section>
    {error&&<div className="cn-feedback cn-error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
    {notice&&<div className="cn-feedback cn-good" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice">×</button></div>}
    <div className="cn-stats">
      <div><span>CONSIGNEE RECORDS</span><strong>{loading?"—":rows.totalElements.toLocaleString()}</strong><small>Database-backed count</small></div>
      <div><span>SHIPMENTS READY</span><strong>{loading?"—":shipmentsReady.length}</strong><small>First 100 recent shipments</small></div>
      <div><span>RECIPIENT CONTROLS</span><strong>Verified</strong><small>Shipment customer must match</small></div>
    </div>
    <section className="cn-panel">
      <div className="cn-panel-head">
        <div><p className="cn-eyebrow">RECIPIENT MASTER DATA</p><h2>Consignees</h2></div>
        <form onSubmit={e=>{e.preventDefault();setPage(0);setTerm(query.trim());}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Company, code, or customer" aria-label="Search consignees"/>
          <button type="submit">Search</button>
        </form>
      </div>
      <div className="cn-scroll"><table>
        <thead><tr><th>CONSIGNEE</th><th>CUSTOMER</th><th>COUNTRY</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
        <tbody>{rows.content.map(row=><tr key={row.id}>
          <td><strong>{row.company_name}</strong><small>{row.code}</small></td>
          <td>{row.customer_name}</td><td>{row.country_code.trim().toUpperCase()}</td>
          <td><span className={"cn-pill "+(row.active?"cn-active":"")}>{row.active?"Active":"Inactive"}</span></td>
          <td><button onClick={()=>startEdit(row)} type="button">Edit ↗</button></td>
        </tr>)}</tbody>
      </table>
      {!loading&&rows.content.length===0&&<p className="cn-empty">No consignees found. Add the first record or change your search.</p>}
      {loading&&rows.content.length===0&&<p className="cn-empty">Loading records…</p>}
      </div>
      <div className="cn-pager"><span>Page {page+1} of {Math.max(1,rows.totalPages)}</span>
        <div><button onClick={()=>setPage(v=>Math.max(0,v-1))} disabled={page===0}>Previous</button>
          <button onClick={()=>setPage(v=>v+1)} disabled={page+1>=rows.totalPages}>Next</button></div>
      </div>
    </section>
    <section className="cn-panel">
      <div className="cn-panel-head">
        <div><p className="cn-eyebrow">SHIPMENT READINESS</p><h2>Assign receiving party</h2>
          <p>Only booked shipments can change their consignee.</p></div>
      </div>
      <div className="cn-shipments">
        {shipmentsReady.slice(0,12).map(shipment=><div key={shipment.id} className="cn-shipment">
          <div><strong>{shipment.reference}</strong><small>{shipment.consignee_name??"Recipient not assigned"}</small></div>
          <button type="button" onClick={()=>openShipment(shipment)}>
            {shipment.consignee_id?"Change consignee":"Assign consignee"} ↗
          </button>
        </div>)}
        {!loading&&shipmentsReady.length===0&&<p className="cn-empty">No booked shipments in the recent records.</p>}
      </div>
    </section>
    <p className="cn-footnote">Internal development system. Do not enter live commercial data until the production security review is complete.</p>

    {showForm&&<div className="cn-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setShowForm(false);}}>
      <div className="cn-modal" role="dialog" aria-modal="true" aria-labelledby="cn-form-title">
        <header><div><p className="cn-eyebrow">CUSTOMER-SCOPED RECIPIENT</p><h2 id="cn-form-title">{editing?"Edit consignee":"Add consignee"}</h2></div>
          <button type="button" onClick={()=>setShowForm(false)} disabled={saving} aria-label="Close dialog">×</button></header>
        <form onSubmit={e=>void save(e)}>
          <label>Customer owner<select required value={draft.customerId} disabled={!!editing}
            onChange={e=>field("customerId",e.target.value)}>
            <option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>Company name<input required maxLength={180} value={draft.companyName} onChange={e=>field("companyName",e.target.value)}/></label>
          <div className="cn-form-grid">
            <label>Contact name<input maxLength={120} value={draft.contactName} onChange={e=>field("contactName",e.target.value)}/></label>
            <label>ISO country code<input required pattern="[A-Za-z]{2}" maxLength={2} placeholder="NL" value={draft.countryCode}
              onChange={e=>field("countryCode",e.target.value)}/></label>
          </div>
          <div className="cn-form-grid">
            <label>Email<input type="email" maxLength={240} value={draft.email} onChange={e=>field("email",e.target.value)}/></label>
            <label>Phone<input maxLength={60} value={draft.phone} onChange={e=>field("phone",e.target.value)}/></label>
          </div>
          <label>Warehouse / delivery address<textarea required maxLength={500} rows={3} value={draft.address} onChange={e=>field("address",e.target.value)}/></label>
          {editing&&<label className="cn-checkbox"><input type="checkbox" checked={draft.active}
            onChange={e=>field("active",e.target.checked)}/> Active for shipment assignments</label>}
          <footer><button type="button" onClick={()=>setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="cn-primary" disabled={saving}>{saving?"Saving…":"Save consignee →"}</button></footer>
        </form>
      </div>
    </div>}

    {shipping&&<div className="cn-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setShipping(null);}}>
      <div className="cn-modal" role="dialog" aria-modal="true" aria-labelledby="cn-assign-title">
        <header><div><p className="cn-eyebrow">PRE-DISPATCH CONTROL</p><h2 id="cn-assign-title">Assign {shipping.reference}</h2></div>
          <button type="button" onClick={()=>setShipping(null)} disabled={saving} aria-label="Close dialog">×</button></header>
        <form onSubmit={e=>void assign(e)}>
          <p>Choose an active consignee registered under this shipment&apos;s customer.</p>
          <label>Search this customer&apos;s recipients
            <div className="cn-recipient-search">
              <input value={recipientQuery} onChange={e=>setRecipientQuery(e.target.value)}
                placeholder="Name or consignee code" aria-label="Search eligible recipients" />
              <button type="button" onClick={()=>{setRecipientPage(0);setRecipient("");
                setRecipientTerm(recipientQuery.trim());}}>Find</button>
            </div>
          </label>
          <label>Consignee<select required value={recipient} onChange={e=>setRecipient(e.target.value)}>
            <option value="">Select receiving party</option>
            {matching.content.filter(c=>c.active).map(c=>
              <option key={c.id} value={c.id}>{c.company_name} · {c.code}</option>)}
          </select></label>
          <div className="cn-recipient-pager"><span>{matching.totalElements} matching records</span>
            <button type="button" disabled={recipientPage===0} onClick={()=>{setRecipient("");
              setRecipientPage(p=>Math.max(0,p-1));}}>Previous</button>
            <button type="button" disabled={recipientPage+1>=matching.totalPages} onClick={()=>{setRecipient("");
              setRecipientPage(p=>p+1);}}>Next</button>
          </div>
          <p className="cn-hint">Only active recipients with the same customer are eligible. Final validation runs on the server.</p>
          {error&&<p className="cn-inline-error" role="alert">{error}</p>}
          <footer><button type="button" onClick={()=>setShipping(null)} disabled={saving}>Cancel</button>
            <button type="submit" className="cn-primary" disabled={saving||!recipient}>Assign recipient →</button></footer>
        </form>
      </div>
    </div>}
  </main>;
}
