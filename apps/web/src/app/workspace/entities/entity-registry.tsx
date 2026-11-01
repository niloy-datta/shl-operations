"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Page<T>={content:T[];totalElements:number;totalPages:number};
type Owner={id:string;name:string};
type Kind="CUSTOMER"|"SUPPLIER"|"PARTNER"|"OFFICE";
type Entity={
  id:string;reference:string;kind:Kind;customer_id:string|null;supplier_id:string|null;
  legal_name:string;branch_name:string|null;country_code:string;city:string|null;
  website:string|null;registration_number:string|null;status:"ACTIVE"|"INACTIVE";
  customer_name:string|null;supplier_name:string|null;
};
type Person={id:string;full_name:string;position_title:string|null;contact_role:string;
  email:string|null;phone:string|null;is_primary:boolean;active:boolean};
type Entry={
  kind:Kind;customerId:string;supplierId:string;legalName:string;branchName:string;
  countryCode:string;city:string;website:string;registrationNumber:string;status:"ACTIVE"|"INACTIVE";
};
type ContactDraft={fullName:string;positionTitle:string;contactRole:string;email:string;
  phone:string;primary:boolean;active:boolean};
const emptyEntry:Entry={kind:"CUSTOMER",customerId:"",supplierId:"",legalName:"",
  branchName:"",countryCode:"",city:"",website:"",registrationNumber:"",status:"ACTIVE"};
const emptyContact:ContactDraft={fullName:"",positionTitle:"",contactRole:"BUYING",
  email:"",phone:"",primary:false,active:true};
const ROLES=["BUYING","FINANCE","LOGISTICS","MANAGEMENT","COMPLIANCE","OTHER"];
const route="/api/enterprise/entities";
async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const res=await fetch(path,{cache:"no-store",...init});
  if(res.status===401){window.location.assign("/login");throw new Error("Session expired");}
  if(!res.ok){
    const data=await res.json().catch(()=>null);
    if(res.status===403)throw new Error("Your account cannot perform this action");
    if(res.status===409)throw new Error("Ownership conflict, duplicate primary contact, or invalid state");
    throw new Error(typeof data?.error==="string"?data.error:"Request failed ("+res.status+")");
  }
  return res.json() as Promise<T>;
}
function save<T>(path:string,method:"POST"|"PATCH",input:object):Promise<T>{
  return api<T>(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(input)});
}
export function EntityRegistry(){
  const [user,setUser]=useState<{role:string;username:string}|null>(null);
  const [entities,setEntities]=useState<Page<Entity>>({content:[],totalElements:0,totalPages:0});
  const [customerChoices,setCustomerChoices]=useState<Owner[]>([]);
  const [supplierChoices,setSupplierChoices]=useState<Owner[]>([]);
  const [contacts,setContacts]=useState<Page<Person>>({content:[],totalElements:0,totalPages:0});
  const [selected,setSelected]=useState<Entity|null>(null);
  const [form,setForm]=useState<"entity"|"contact"|null>(null);
  const [editingEntity,setEditingEntity]=useState<string|null>(null);
  const [editingContact,setEditingContact]=useState<string|null>(null);
  const [entry,setEntry]=useState<Entry>(emptyEntry);
  const [person,setPerson]=useState<ContactDraft>(emptyContact);
  const [page,setPage]=useState(0);
  const [contactPage,setContactPage]=useState(0);
  const [search,setSearch]=useState("");
  const [term,setTerm]=useState("");
  const [revision,setRevision]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  const canWrite=user?.role==="ADMIN"||user?.role==="MANAGEMENT";

  useEffect(()=>{
    let alive=true;
    Promise.all([
      api<{role:string;username:string}>("/api/data/me"),
      api<Page<Owner>>("/api/data/customers?page=0&size=100"),
      api<Page<Owner>>("/api/data/suppliers?page=0&size=100")
    ]).then(([person,customers,suppliers])=>{
      if(!alive)return;
      setUser(person);setCustomerChoices(customers.content);setSupplierChoices(suppliers.content);
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Cannot load identity");});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    let alive=true;
    const q=new URLSearchParams({page:String(page),size:"15",q:term});
    api<Page<Entity>>(route+"?"+q).then(result=>{
      if(alive){setEntities(result);setLoading(false);}
    }).catch(e=>{if(alive){setError(e instanceof Error?e.message:"Cannot load entities");setLoading(false);}});
    return()=>{alive=false;};
  },[page,term,revision]);
  useEffect(()=>{
    if(!selected)return;
    let alive=true;
    api<Page<Person>>(route+"/"+selected.id+"/contacts?page="+contactPage+"&size=15")
      .then(result=>{if(alive)setContacts(result);})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Cannot load contacts");});
    return()=>{alive=false;};
  },[selected,contactPage,revision]);

  function openNewEntity(){setEntry({...emptyEntry});setEditingEntity(null);setForm("entity");setError("");}
  function openEditEntity(e:Entity){
    setEntry({kind:e.kind,customerId:e.customer_id??"",supplierId:e.supplier_id??"",
      legalName:e.legal_name,branchName:e.branch_name??"",countryCode:e.country_code.trim(),
      city:e.city??"",website:e.website??"",registrationNumber:e.registration_number??"",status:e.status});
    setEditingEntity(e.id);setForm("entity");setError("");
  }
  function openContactEdit(c?:Person){
    setPerson(c?{fullName:c.full_name,positionTitle:c.position_title??"",contactRole:c.contact_role,
      email:c.email??"",phone:c.phone??"",primary:c.is_primary,active:c.active}:{...emptyContact});
    setEditingContact(c?.id??null);setForm("contact");setError("");
  }
  function editEntry<K extends keyof Entry>(field:K,value:Entry[K]){setEntry(v=>({...v,[field]:value}));}
  function editContact<K extends keyof ContactDraft>(field:K,value:ContactDraft[K]){setPerson(v=>({...v,[field]:value}));}
  async function submitEntity(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    const payload={...entry,customerId:entry.kind==="CUSTOMER"?entry.customerId:null,
      supplierId:entry.kind==="SUPPLIER"?entry.supplierId:null,
      branchName:entry.branchName||null,city:entry.city||null,website:entry.website||null,
      registrationNumber:entry.registrationNumber||null,countryCode:entry.countryCode.toUpperCase()};
    try{
      await save<Entity>(editingEntity?route+"/"+editingEntity:route,editingEntity?"PATCH":"POST",payload);
      setForm(null);setNotice(editingEntity?"Entity updated":"Business entity created");
      setPage(0);refresh();
      if(editingEntity){setSelected(null);setContacts({content:[],totalPages:0,totalElements:0});}
    }catch(e){setError(e instanceof Error?e.message:"Save failed");}
    finally{setBusy(false);}
  }
  async function submitContact(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!selected)return;
    setBusy(true);setError("");setNotice("");
    try{
      await save<Person>(route+"/"+selected.id+"/contacts"+
        (editingContact?"/"+editingContact:""),editingContact?"PATCH":"POST",{
          ...person,positionTitle:person.positionTitle||null,email:person.email||null,
          phone:person.phone||null
        });
      setForm(null);setNotice(editingContact?"Contact updated":"Contact added");setContactPage(0);refresh();
    }catch(e){setError(e instanceof Error?e.message:"Save failed");}
    finally{setBusy(false);}
  }
  const linkOwner=entry.kind==="CUSTOMER"||entry.kind==="SUPPLIER";
  const choices=entry.kind==="CUSTOMER"?customerChoices:supplierChoices;

  return <main className="cn-shell enregistry">
    <div className="cn-top"><Link className="cn-back" href="/workspace">← Operations overview</Link>
      <div className="cn-top-actions"><Link href="/workspace/consignees">Consignees ↗</Link><button onClick={refresh}>Refresh</button></div>
    </div>
    <section className="cn-hero">
      <p className="cn-eyebrow">SHL INTERNATIONAL · MASTER DATA & GOVERNANCE</p>
      <h1>Global entities <span>& contacts.</span></h1>
      <p>A controlled directory of international customers, suppliers, offices and trading partners.
        Keep legal identity, branch locations and buying, finance or logistics contacts aligned.</p>
      <div className="cn-hero-actions">
        {canWrite&&<button className="cn-primary" onClick={openNewEntity}>+ Add organization</button>}
        <span>Role-controlled · Customer-linked · Audited</span>
      </div>
    </section>
    {error&&<div className="cn-feedback cn-error" role="alert">{error}
      <button onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
    {notice&&<div className="cn-feedback cn-good" role="status">{notice}
      <button onClick={()=>setNotice("")} aria-label="Dismiss notice">×</button></div>}
    <div className="cn-stats">
      <div><span>REGISTERED ENTITIES</span><strong>{loading?"—":entities.totalElements}</strong><small>Saved organizations</small></div>
      <div><span>DIRECTORY POLICY</span><strong>Controlled</strong><small>Admins and management can edit</small></div>
      <div><span>CONTACT OWNERSHIP</span><strong>Linked</strong><small>Role-specific company contacts</small></div>
    </div>
    <section className="cn-panel">
      <div className="cn-panel-head"><div><p className="cn-eyebrow">CORPORATE MASTER RECORDS</p>
        <h2>Organization directory</h2></div>
        <form onSubmit={e=>{e.preventDefault();setPage(0);setTerm(search.trim());}}>
          <input aria-label="Search organizations" placeholder="Search legal name, branch, reference"
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <button>Find</button>
        </form>
      </div>
      <div className="cn-scroll"><table>
        <thead><tr><th>ENTITY</th><th>TYPE</th><th>LOCATION</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
        <tbody>{entities.content.map(e=><tr key={e.id}>
          <td><strong>{e.legal_name}</strong><small>{e.reference} · {e.branch_name??"Main office"}</small></td>
          <td>{e.kind}</td><td>{[e.city,e.country_code].filter(Boolean).join(", ")}</td>
          <td><span className={"cn-pill "+(e.status==="ACTIVE"?"cn-active":"")}>{e.status}</span></td>
          <td className="enregistry-actions">
            <button onClick={()=>{setSelected(e);setContactPage(0);setContacts({content:[],totalPages:0,totalElements:0});}}>
              Contacts ↗</button>
            {canWrite&&<button onClick={()=>openEditEntity(e)}>Edit</button>}
          </td>
        </tr>)}</tbody>
      </table>{!loading&&entities.content.length===0&&<p className="cn-empty">No entities found. Create your first record or search again.</p>}
        {loading&&<p className="cn-empty">Loading…</p>}
      </div>
      <div className="cn-pager"><span>Page {page+1} of {Math.max(entities.totalPages,1)}</span>
        <div><button disabled={page===0} onClick={()=>setPage(v=>v-1)}>Previous</button>
          <button disabled={page+1>=entities.totalPages} onClick={()=>setPage(v=>v+1)}>Next</button></div>
      </div>
    </section>
    {selected&&<section className="cn-panel">
      <div className="cn-panel-head"><div><p className="cn-eyebrow">{selected.reference} · ROLE CONTACTS</p>
        <h2>{selected.legal_name}</h2><p>{selected.customer_name??selected.supplier_name??"Independent corporate entity"}</p></div>
        <div className="enregistry-head-actions">
          {canWrite&&<button className="cn-primary" onClick={()=>openContactEdit()}>+ Add contact</button>}
          <button onClick={()=>setSelected(null)}>Close</button>
        </div>
      </div>
      <div className="cn-scroll"><table><thead><tr><th>NAME</th><th>DEPARTMENT</th><th>CONTACT</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
        <tbody>{contacts.content.map(c=><tr key={c.id}>
          <td><strong>{c.full_name}</strong><small>{c.position_title??"—"}</small></td>
          <td>{c.contact_role}{c.is_primary?" · Primary":""}</td><td>{c.email??c.phone??"—"}</td>
          <td><span className={"cn-pill "+(c.active?"cn-active":"")}>{c.active?"Active":"Inactive"}</span></td>
          <td>{canWrite&&<button onClick={()=>openContactEdit(c)}>Edit ↗</button>}</td>
        </tr>)}</tbody>
      </table>{contacts.content.length===0&&<p className="cn-empty">No contacts for this organization.</p>}</div>
      <div className="cn-pager"><span>Page {contactPage+1} of {Math.max(contacts.totalPages,1)}</span>
        <div><button disabled={contactPage===0} onClick={()=>setContactPage(v=>v-1)}>Previous</button>
          <button disabled={contactPage+1>=contacts.totalPages} onClick={()=>setContactPage(v=>v+1)}>Next</button></div>
      </div>
    </section>}
    <p className="cn-footnote">Development-only. Commercial records, contacts and actual business data must not be imported before security review and approvals.</p>

    {form&&<div className="cn-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setForm(null);}}>
      <div className="cn-modal" role="dialog" aria-modal="true" aria-labelledby="registry-form-heading">
        <header><div><p className="cn-eyebrow">{form==="entity"?"CORPORATE IDENTITY":"ROLE CONTACT"}</p>
          <h2 id="registry-form-heading">{form==="entity"?(editingEntity?"Edit organization":"New organization"):(editingContact?"Edit contact":"Add contact")}</h2></div>
          <button onClick={()=>setForm(null)} disabled={busy} aria-label="Close dialog">×</button>
        </header>
        {form==="entity"?<form onSubmit={e=>void submitEntity(e)}>
          <label>Entity type<select required disabled={!!editingEntity} value={entry.kind}
            onChange={e=>{editEntry("kind",e.target.value as Kind);}}>
            {(["CUSTOMER","SUPPLIER","PARTNER","OFFICE"] as Kind[]).map(k=><option key={k} value={k}>{k}</option>)}
          </select></label>
          {linkOwner&&<label>Linked {entry.kind.toLowerCase()} <select required disabled={!!editingEntity}
            value={entry.kind==="CUSTOMER"?entry.customerId:entry.supplierId}
            onChange={e=>editEntry(entry.kind==="CUSTOMER"?"customerId":"supplierId",e.target.value)}>
            <option value="">Select existing record</option>
            {choices.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select></label>}
          <label>Legal name<input required maxLength={180} value={entry.legalName}
            onChange={e=>editEntry("legalName",e.target.value)}/></label>
          <div className="cn-form-grid">
            <label>Branch name<input maxLength={160} value={entry.branchName} onChange={e=>editEntry("branchName",e.target.value)}/></label>
            <label>Country code<input required pattern="[A-Za-z]{2}" maxLength={2} value={entry.countryCode}
              onChange={e=>editEntry("countryCode",e.target.value)}/></label>
          </div>
          <div className="cn-form-grid">
            <label>City<input maxLength={120} value={entry.city} onChange={e=>editEntry("city",e.target.value)}/></label>
            <label>Registration number<input maxLength={120} value={entry.registrationNumber}
              onChange={e=>editEntry("registrationNumber",e.target.value)}/></label>
          </div>
          <label>Website (HTTPS)<input type="url" placeholder="https://example.com" maxLength={240} value={entry.website}
            onChange={e=>editEntry("website",e.target.value)}/></label>
          <label>Record status<select value={entry.status} onChange={e=>editEntry("status",e.target.value as Entry["status"])}>
            <option>ACTIVE</option><option>INACTIVE</option></select></label>
          <footer><button type="button" onClick={()=>setForm(null)}>Cancel</button>
            <button className="cn-primary" disabled={busy}>{busy?"Saving…":"Save organization →"}</button></footer>
        </form>:<form onSubmit={e=>void submitContact(e)}>
          <label>Full name<input required maxLength={160} value={person.fullName}
            onChange={e=>editContact("fullName",e.target.value)}/></label>
          <label>Job title<input maxLength={120} value={person.positionTitle}
            onChange={e=>editContact("positionTitle",e.target.value)}/></label>
          <label>Department<select value={person.contactRole}
            onChange={e=>editContact("contactRole",e.target.value)}>
            {ROLES.map(k=><option key={k}>{k}</option>)}</select></label>
          <div className="cn-form-grid">
            <label>Email<input type="email" maxLength={240} value={person.email} onChange={e=>editContact("email",e.target.value)}/></label>
            <label>Phone<input maxLength={60} value={person.phone} onChange={e=>editContact("phone",e.target.value)}/></label>
          </div>
          <label className="cn-checkbox"><input type="checkbox" checked={person.primary}
            onChange={e=>editContact("primary",e.target.checked)}/> Primary contact for this department</label>
          <label className="cn-checkbox"><input type="checkbox" checked={person.active}
            onChange={e=>editContact("active",e.target.checked)}/> Active contact</label>
          <p className="cn-hint">At most one active primary person per department. Consent to receive marketing messages is not implied.</p>
          <footer><button type="button" onClick={()=>setForm(null)}>Cancel</button>
            <button className="cn-primary" disabled={busy}>{busy?"Saving…":"Save contact →"}</button></footer>
        </form>}
        {error&&<p className="enregistry-inline-error" role="alert">{error}</p>}
      </div>
    </div>}
  </main>;
}
