"use client";

import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent,type ReactNode} from "react";
import {useRouter} from "next/navigation";

type Module="leads"|"projects";
type Item=Record<string,unknown>;
type User={username:string;role:string};
type Page={content:Item[];totalElements:number;totalPages:number};
type Lookup={id:string;text:string;extra?:string};
const roles=["ADMIN","MANAGEMENT","BD"];
const stages:Record<Module,Record<string,string[]>>={
  leads:{NEW:["CONTACTED","QUALIFIED","LOST"],CONTACTED:["QUALIFIED","LOST"],
    QUALIFIED:["WON","LOST"],WON:[],LOST:[]},
  projects:{PLANNED:["ACTIVE","CANCELLED"],ACTIVE:["ON_HOLD","COMPLETED","CANCELLED"],
    ON_HOLD:["ACTIVE","CANCELLED"],COMPLETED:[],CANCELLED:[]}
};
const moduleInfo={
  leads:{title:"Growth pipeline",eyebrow:"CUSTOMER ACQUISITION",subtitle:"Every inbound opportunity has an owner, qualification stage and follow-up date.",
    action:"Register lead",fields:[["reference","LEAD"],["company_name","COMPANY"],["subject","OPPORTUNITY"],["owner_name","OWNER"],["next_follow_up","NEXT FOLLOW-UP"],["status","STAGE"]]},
  projects:{title:"Project command",eyebrow:"DELIVERY OPERATIONS",subtitle:"A single traceable job ID for commercial ownership, deadlines, and project notes.",
    action:"Create project",fields:[["reference","JOB"],["title","PROJECT"],["customer_name","CUSTOMER"],["owner_name","OWNER"],["due_date","DEADLINE"],["status","STAGE"]]}
} as const;
const t=(v:unknown)=>v===null||v===undefined||v===""?"—":String(v);
const date=(v:unknown)=>!v?"—":new Date(String(v)).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
async function fetchJson<T>(path:string,init?:RequestInit):Promise<T>{
  const res=await fetch(path,{cache:"no-store",...init});
  if(res.status===401){window.location.assign("/login");throw new Error("Session expired");}
  if(!res.ok){
    if(res.status===403)throw new Error("Your account is not permitted to perform this action.");
    if(res.status===409)throw new Error("Workflow conflict. Check linked customer, owner and current status.");
    if(res.status===400)throw new Error("Check required fields and formatting.");
    throw new Error("Request failed ("+res.status+").");
  }
  return res.json() as Promise<T>;
}
const post=<T,>(path:string,payload:unknown,method:"POST"|"PATCH"="POST")=>
  fetchJson<T>(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
const api="/api/growth/";
function Field({label,name,type="text",required=false,children,placeholder}:{
  label:string;name:string;type?:string;required?:boolean;children?:ReactNode;placeholder?:string
}){
  return <label className="en-field"><span>{label}{required&&" *"}</span>
    {children??<input name={name} type={type} placeholder={placeholder} required={required} maxLength={240}/>}
  </label>;
}
function Pick({name,label,items,optional=false}:{
  name:string;label:string;items:Lookup[];optional?:boolean
}){
  return <Field name={name} label={label} required={!optional}>
    <select name={name} required={!optional} defaultValue="">
      <option value="">{optional?"Not linked":"Select one"}</option>
      {items.map(x=><option key={x.id} value={x.id}>{x.text}{x.extra?" · "+x.extra:""}</option>)}
    </select>
  </Field>;
}
export function GrowthDesk({module}:{module:Module}){
  const router=useRouter();
  const meta=moduleInfo[module];
  const [me,setMe]=useState<User|null>(null);
  const [items,setItems]=useState<Page>({content:[],totalElements:0,totalPages:0});
  const [page,setPage]=useState(0),[query,setQuery]=useState("");
  const [term,setTerm]=useState(""),[tick,setTick]=useState(0);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [dialog,setDialog]=useState<"create"|"details"|null>(null);
  const [active,setActive]=useState<Item|null>(null);
  const [refs,setRefs]=useState<{customers:Lookup[];staff:Lookup[];leads:Lookup[];orders:Lookup[]}>({
    customers:[],staff:[],leads:[],orders:[]
  });
  const [notes,setNotes]=useState<Item[]>([]);
  const reload=useCallback(()=>setTick(n=>n+1),[]);

  useEffect(()=>{
    let alive=true;
    fetchJson<User>("/api/data/me").then(x=>{if(alive)setMe(x);})
      .catch(e=>{if(alive)setError(String(e));});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!me||!["ADMIN","MANAGEMENT","BD","SOURCING","LOGISTICS","FINANCE"].includes(me.role))return;
    if(module==="leads"&&!roles.includes(me.role))return;
    let alive=true;
    const frame=requestAnimationFrame(()=>setLoading(true));
    fetchJson<Page>(api+module+"?"+new URLSearchParams({page:String(page),size:"15",q:term}))
      .then(data=>{if(alive){setItems(data);setError("");}})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Unable to fetch records.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;cancelAnimationFrame(frame);};
  },[me,module,page,term,tick]);

  const canWrite=!!me&&roles.includes(me.role);
  const canView=!!me&&(module==="projects"?
    ["ADMIN","MANAGEMENT","BD","SOURCING","LOGISTICS","FINANCE"].includes(me.role):canWrite);
  const lookup=(rows:Item[],key:string,extra?:string):Lookup[]=>
    rows.map(x=>({id:String(x.id),text:String(x[key]??x.id),
      extra:extra?String(x[extra]??""):undefined}));
  async function create(){
    setError("");setNotice("");setActive(null);setDialog("create");
    try{
      const [customerResult,staffResult,leadResult,orderResult]=await Promise.all([
        fetchJson<Page>("/api/data/customers?size=100"),
        fetchJson<Item[]>("/api/enterprise/staff/options"),
        module==="projects"?fetchJson<Page>(api+"leads?size=100"):Promise.resolve(null),
        module==="projects"?fetchJson<Page>("/api/enterprise/commerce/orders?size=100"):Promise.resolve(null)
      ]);
      setRefs({customers:lookup(customerResult.content,"name"),staff:lookup(staffResult,"username"),
        leads:lookup((leadResult?.content??[]).filter(x=>x.status==="WON"),"reference","company_name"),
        orders:lookup((orderResult?.content??[]).filter(x=>
          ["CONFIRMED","IN_PROGRESS","COMPLETED"].includes(String(x.status))),"reference")});
    }catch(e){setError(e instanceof Error?e.message:"Unable to load available records.");}
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const data=new FormData(event.currentTarget),v=(key:string)=>String(data.get(key)??"").trim();
    const payload=module==="leads"?{
      customerId:v("customerId")||null,companyName:v("companyName"),contactName:v("contactName"),
      contactEmail:v("contactEmail")||null,source:v("source"),subject:v("subject"),
      description:v("description")||null,ownerId:v("ownerId")||null,
      nextFollowUp:v("nextFollowUp")||null
    }:{
      customerId:v("customerId"),leadId:v("leadId")||null,salesOrderId:v("salesOrderId")||null,
      title:v("title"),description:v("description")||null,ownerId:v("ownerId"),
      dueDate:v("dueDate")||null
    };
    try{
      await post<Item>(api+module,payload);
      setDialog(null);setPage(0);setNotice(module==="leads"?"Lead registered.":"Project created.");
      reload();
    }catch(e){setError(e instanceof Error?e.message:"Unable to create record.");}
    finally{setBusy(false);}
  }
  async function status(item:Item,next:string){
    setBusy(true);setError("");
    try{
      await post<Item>(api+module+"/"+item.id+"/status",{status:next},"PATCH");
      setActive(null);setDialog(null);setNotice("Status updated to "+next.replaceAll("_"," ").toLowerCase()+".");reload();
    }catch(e){setError(e instanceof Error?e.message:"Could not change status.");}
    finally{setBusy(false);}
  }
  async function details(item:Item){
    setActive(item);setDialog("details");setNotes([]);setError("");
    try{
      setNotes(await fetchJson<Item[]>(api+module+"/"+item.id+
        (module==="leads"?"/activity":"/notes")));
    }catch{setError("Unable to load activity records.");}
  }
  async function addNote(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!active)return;
    setBusy(true);setError("");
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const path=api+module+"/"+active.id+(module==="leads"?"/activity":"/notes");
    const note=String(form.get("note")??"").trim();
    const payload=module==="leads"?{
      activityType:String(form.get("activityType")??"NOTE"),
      note,nextFollowUp:String(form.get("nextFollowUp")??"")||null
    }:{note};
    try{
      await post<Item>(path,payload);
      setNotes(await fetchJson<Item[]>(path));
      if(module==="leads"){
        setActive(await fetchJson<Item>(api+"leads/"+active.id));
        reload();
      }
      formElement.reset();
    }catch(e){setError(e instanceof Error?e.message:"Could not record activity.");}
    finally{setBusy(false);}
  }
  async function logout(){
    const res=await fetch("/api/auth/logout",{method:"POST"});
    if(res.ok){router.replace("/login");router.refresh();}
    else setError("Sign-out could not revoke the session. Retry.");
  }

  return <div className="en-app">
    <aside className="en-sidebar">
      <Link className="en-brand" href="/workspace"><span className="en-logo">S</span>
        <span><strong>SHL<span>.</span></strong><small>INTERNATIONAL</small></span></Link>
      <div className="en-edition"><span className="en-dot"/> OPERATIONS OS <span>ENTERPRISE</span></div>
      <div className="en-nav-scroll"><p className="en-nav-label">CONNECTED WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {[
            {url:"/workspace",label:"Overview",symbol:"▦"},
            {url:"/workspace?view=customers",label:"Customers",symbol:"♙"},
            {url:"/workspace?view=suppliers",label:"Suppliers",symbol:"◇"},
            {url:"/workspace/rfqs",label:"RFQ sourcing",symbol:"▤"},
            {url:"/workspace/alerts",label:"Due dates & alerts",symbol:"◉"},
            {url:"/workspace/growth/leads",label:"Lead pipeline",symbol:"✧",roles},
            {url:"/workspace/growth/projects",label:"Projects & jobs",symbol:"▱"},
            {url:"/workspace/enterprise/quotes",label:"Quotations",symbol:"◈"},
            {url:"/workspace/enterprise/orders",label:"Sales orders",symbol:"▣"},
            {url:"/workspace/enterprise/shipments",label:"Shipments",symbol:"⇢"},
            {url:"/workspace/enterprise/tasks",label:"Team tasks",symbol:"☷"},
            {url:"/workspace/costs/expenses",label:"Expenses",symbol:"◎",
              roles:["ADMIN","MANAGEMENT","FINANCE"]},
            {url:"/workspace/account",label:"Account security",symbol:"◌"}
          ].filter(x=>!x.roles||!me||x.roles.includes(me.role)).map(x=>
            <Link key={x.url} href={x.url} className={"en-nav-item "+
              (x.url.endsWith("/"+module)?"active":"")}>
              <span className="en-nav-symbol">{x.symbol}</span>{x.label}</Link>)}
        </nav>
      </div>
      <div className="en-sidebar-bottom"><div className="en-private">◈ Private enterprise workspace</div>
        <div className="en-profile"><span className="en-profile-avatar">{me?.username?.slice(0,1).toUpperCase()??"?"}</span>
          <span><strong>{me?.username??"Loading"}</strong><small>{me?.role??"Staff account"}</small></span>
          <button aria-label="Sign out" title="Sign out" onClick={()=>void logout()}>↗</button>
        </div></div>
    </aside>
    <div className="en-main">
      <header className="en-topbar"><div>SHL Operations <span>/</span> <strong>{meta.title}</strong></div>
        <Link href="/workspace" className="gx-back">← Dashboard</Link></header>
      <main className="en-content gx-content">
        <div className="en-heading">
          <div><p className="en-eyebrow">{meta.eyebrow} <span>/</span> LIVE DATA</p>
            <h1>{meta.title}<span>.</span></h1><p>{meta.subtitle}</p></div>
          {canWrite&&<button className="en-primary" onClick={()=>void create()}>＋ {meta.action}</button>}
        </div>
        {error&&<div className="en-alert" role="alert">{error}
          <button onClick={()=>{setError("");reload();}}>Retry</button></div>}
        {notice&&<p className="gx-notice" role="status">{notice}</p>}
        {!me&&!error?<div className="en-panel en-loading">Checking permissions…</div>:
         !canView?<div className="en-panel en-restricted"><h2>Restricted access</h2>
          <p>Your account does not have access to these records.</p></div>:<>
          <section className="gx-banner">
            <div><span className="gx-kicker">A SINGLE SOURCE OF TRUTH</span>
              <h2>{module==="leads"?"Capture opportunities. Build relationships.":"Own every milestone. Deliver with confidence."}</h2>
              <p>{module==="leads"?"Assign ownership, keep follow-ups visible and move qualified leads into jobs.":
                "Link customers, won leads and sales orders with durable project histories."}</p></div>
            <div className="gx-metric"><strong>{items.totalElements.toLocaleString()}</strong>
              <small>{module==="leads"?"TOTAL LEADS":"PROJECT RECORDS"}</small></div>
          </section>
          <section className="en-panel gx-list">
            <div className="gx-toolbar">
              <div><strong>{module==="leads"?"Opportunities":"Project register"}</strong>
                <span>{items.totalElements} records · page {page+1} of {Math.max(1,items.totalPages)}</span></div>
              <form onSubmit={e=>{e.preventDefault();setPage(0);setTerm(query);}} className="gx-search">
                <input aria-label="Search records" value={query} onChange={e=>setQuery(e.target.value)}
                  placeholder={module==="leads"?"Search company or topic":"Search job ID or title"}/>
                <button type="submit">Search</button>
              </form>
            </div>
            <div className="gx-table-wrap"><table className="gx-table"><thead><tr>
              {meta.fields.map(([key,label])=><th key={key}>{label}</th>)}
              <th>RECORD</th></tr></thead><tbody>
              {items.content.map(record=><tr key={String(record.id)}>
                {meta.fields.map(([key])=><td key={key}>
                  {key==="status"?<span className={"gx-stage gx-"+String(record.status).toLowerCase()}>{t(record.status).replaceAll("_"," ")}</span>:
                    key.endsWith("_date")||key==="next_follow_up"?date(record[key]):t(record[key])}
                </td>)}
                <td><button className="gx-open" onClick={()=>void details(record)}>Open ↗</button></td>
              </tr>)}</tbody></table>
              {!loading&&items.content.length===0&&<div className="gx-empty">
                <strong>No {module==="leads"?"leads":"projects"} found</strong>
                <p>{term?"Try a different search term.":"Use the create action to add your first record."}</p></div>}
              {loading&&<p className="gx-loading">Loading records…</p>}
            </div>
            <div className="gx-pagination">
              <span>Showing up to 15 real database records per page</span><div>
                <button disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Previous</button>
                <button disabled={page+1>=items.totalPages} onClick={()=>setPage(p=>p+1)}>Next →</button>
              </div></div>
          </section>
        </>}
      </main>
    </div>
    {dialog&&<div className="gx-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(null);}}>
      <section className="gx-dialog" role="dialog" aria-modal="true" aria-labelledby="gx-dialog-title">
        <header className="gx-dialog-header">
          <div><small>{dialog==="create"?"CREATE NEW RECORD":"RECORD DETAIL"}</small>
            <h2 id="gx-dialog-title">{dialog==="create"?meta.action:t(active?.reference)}</h2></div>
          <button onClick={()=>setDialog(null)} aria-label="Close dialog">×</button>
        </header>
        <div className="gx-dialog-body">
          {error&&<p className="en-alert" role="alert">{error}</p>}
          {dialog==="create"?<form className="gx-form" onSubmit={e=>void submit(e)}>
            {module==="leads"?<>
              <div className="gx-two">
                <Field label="Company" name="companyName" required placeholder="Company legal name"/>
                <Field label="Contact" name="contactName" required placeholder="Primary decision maker"/></div>
              <Field label="Opportunity subject" name="subject" required placeholder="Product or logistics inquiry"/>
              <Field label="Contact email" name="contactEmail" type="email"/>
              <Field label="Lead source" name="source" required><select name="source" defaultValue="WEBSITE">
                {["WEBSITE","EMAIL","WECHAT","REFERRAL","MANUAL","OTHER"].map(x=><option key={x}>{x}</option>)}
              </select></Field>
              <Pick name="customerId" label="Existing customer (optional)" optional items={refs.customers}/>
              <Pick name="ownerId" label="Assign lead owner" optional items={refs.staff}/>
              <Field label="Next follow-up" name="nextFollowUp" type="date"/>
            </>:<>
              <Field label="Project title" name="title" required placeholder="Trading project / shipment engagement"/>
              <Pick name="customerId" label="Customer" items={refs.customers}/>
              <Pick name="ownerId" label="Responsible staff" items={refs.staff}/>
              <Pick name="leadId" label="Linked won lead (optional)" optional items={refs.leads}/>
              <Pick name="salesOrderId" label="Linked confirmed order (optional)" optional items={refs.orders}/>
              <Field label="Due date" name="dueDate" type="date"/>
            </>}
            <Field label="Description / internal context" name="description">
              <textarea name="description" maxLength={2000} rows={3} placeholder="Add business context…"/>
            </Field>
            <p className="en-help">Records persist in PostgreSQL and changes appear in the audit trail.</p>
            <button className="en-primary" type="submit" disabled={busy}>{busy?"Saving…":"Save record →"}</button>
          </form>:active&&<>
            <div className="gx-detail-grid">{Object.entries(active).filter(([k])=>!
              ["description","created_at","updated_at"].includes(k)).map(([key,value])=>
              <div key={key}><small>{key.replaceAll("_"," ").toUpperCase()}</small><strong>
                {key.endsWith("_date")||key==="next_follow_up"?date(value):t(value)}</strong></div>)}</div>
            {active.description&&<p className="gx-description">{t(active.description)}</p>}
            {canWrite&&(stages[module][String(active.status)]??[]).length>0&&<div className="gx-actions">
              <strong>Next workflow action</strong><div>{stages[module][String(active.status)].map(next=>
                <button key={next} disabled={busy} onClick={()=>void status(active,next)}>
                  {next.replaceAll("_"," ")} ↗</button>)}</div>
            </div>}
            <section className="gx-notes">
              <h3>{module==="leads"?"Lead follow-up history":"Project activity notes"}</h3>
              <form onSubmit={e=>void addNote(e)}>
                {module==="leads"&&<div className="gx-two">
                  <Field name="activityType" label="Interaction type">
                    <select name="activityType" defaultValue="NOTE">
                      {["NOTE","CALL","EMAIL","WECHAT","MEETING","OTHER"].map(type=><option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field name="nextFollowUp" label="Next follow-up (optional)" type="date">
                    <input type="date" name="nextFollowUp"
                      min={new Date().toISOString().slice(0,10)}
                      disabled={["WON","LOST"].includes(String(active.status))}/>
                  </Field>
                </div>}
                <textarea name="note" rows={3} maxLength={2000} required
                  placeholder={module==="leads"?"Summarize the last call, email or next action (no message is sent)…":"Record operational updates and decisions…"} />
                <button className="en-primary" type="submit" disabled={busy}>
                  {busy?"Saving…":module==="leads"?"Log follow-up →":"Add note →"}
                </button>
              </form>
              {notes.length===0&&<p className="en-help">No activity recorded yet.</p>}
              {notes.map(note=><article key={String(note.id)}>
                <span>{t(note.actor??note.author)} · {date(note.created_at)}
                  {module==="leads"?" · "+t(note.activity_type):""}
                  {note.next_follow_up?" · Next: "+date(note.next_follow_up):""}</span>
                <p>{t(note.note)}</p>
              </article>)}
              {module==="leads"&&<p className="en-help">These are internal activity records only. No email, WeCom or external message is sent.</p>}
            </section>
          </>}
        </div>
      </section>
    </div>}
  </div>;
}
