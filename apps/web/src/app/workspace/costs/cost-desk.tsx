"use client";
import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent,type ReactNode} from "react";
import {useRouter} from "next/navigation";

type Module="expenses"|"commissions";
type Row=Record<string,unknown>;
type Page={content:Row[];totalElements:number;totalPages:number};
type User={username:string;role:string};
const api="/api/costs/";
const title={expenses:"Project expenses",commissions:"Commission vault"};
const desc={expenses:"Approve traceable operational costs by project and currency.",
  commissions:"Restricted commission calculations, separate history and independent approval."};
const columns={
  expenses:[["reference","EXPENSE"],["project_reference","PROJECT"],["category","CATEGORY"],["amount","AMOUNT"],["currency","CURRENCY"],["status","STATUS"]],
  commissions:[["reference","COMMISSION"],["project_reference","PROJECT"],["beneficiary","BENEFICIARY"],["beneficiary_type","TYPE"],["commission_amount","AMOUNT"],["currency","CURRENCY"],["status","STATUS"]]
};
const txt=(v:unknown)=>v===null||v===undefined||v===""?"—":String(v);
async function get<T>(url:string,opts?:RequestInit):Promise<T>{
  const response=await fetch(url,{cache:"no-store",...opts});
  if(response.status===401){window.location.assign("/login");throw new Error("Session expired.");}
  if(!response.ok){
    if(response.status===403)throw new Error("This information requires explicit authorization.");
    if(response.status===409)throw new Error("Approval conflict: check creator identity and current status.");
    if(response.status===400)throw new Error("Invalid input or linked record.");
    throw new Error("Unable to complete request.");
  }
  return response.json() as Promise<T>;
}
function Field({label,name,type="text",children,required=false}:{
  label:string;name:string;type?:string;children?:ReactNode;required?:boolean
}){
  return <label className="en-field"><span>{label}{required?" *":""}</span>
    {children??<input type={type} name={name} required={required}
      step={type==="number"?"0.0001":undefined} min={type==="number"?"0.0001":undefined}/>}
  </label>;
}
export function CostDesk({module}:{module:Module}){
  const router=useRouter();
  const [me,setMe]=useState<User|null>(null);
  const [authorized,setAuthorized]=useState<boolean|null>(null);
  const [page,setPage]=useState(0),[term,setTerm]=useState(""),[q,setQ]=useState("");
  const [tick,setTick]=useState(0),[loading,setLoading]=useState(true);
  const [records,setRecords]=useState<Page>({content:[],totalElements:0,totalPages:0});
  const [projects,setProjects]=useState<Row[]>([]);
  const [summary,setSummary]=useState<Row[]>([]);
  const [active,setActive]=useState<Row|null>(null);
  const [history,setHistory]=useState<Row[]>([]);
  const [modal,setModal]=useState<"create"|"details"|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const refresh=useCallback(()=>setTick(x=>x+1),[]);
  useEffect(()=>{
    let alive=true;
    Promise.all([
      get<User>("/api/data/me"),
      get<{allowed:boolean}>(api+"commissions/access")
    ]).then(([u,a])=>{if(alive){setMe(u);setAuthorized(a.allowed);}})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Cannot check access.");});
    return()=>{alive=false;};
  },[]);
  const permitted=module==="commissions"?authorized===true:
    !!me&&["ADMIN","MANAGEMENT","FINANCE"].includes(me.role);
  useEffect(()=>{
    if(!me||authorized===null||!permitted)return;
    let alive=true;
    const frame=requestAnimationFrame(()=>setLoading(true));
    Promise.all([
      get<Page>(api+module+"?"+new URLSearchParams({page:String(page),size:"15",q:term})),
      module==="expenses"?get<Row[]>(api+"expenses/summary"):Promise.resolve([])
    ]).then(([r,s])=>{if(alive){setRecords(r);setSummary(s);setError("");}})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Unable to load finance records.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;cancelAnimationFrame(frame);};
  },[module,me,authorized,permitted,page,term,tick]);

  async function create(){
    setError("");setModal("create");setActive(null);
    try{
      const response=await get<Page>("/api/growth/projects?size=100");
      setProjects(response.content.filter(x=>x.status!=="CANCELLED"));
    }catch(e){setError(e instanceof Error?e.message:"Could not load projects.");}
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const fd=new FormData(event.currentTarget),v=(key:string)=>String(fd.get(key)??"").trim();
    const body=module==="expenses"?{
      projectId:v("projectId"),category:v("category"),description:v("description"),
      amount:v("amount"),currency:v("currency").toUpperCase(),incurredOn:v("incurredOn")
    }:{
      projectId:v("projectId"),beneficiaryType:v("beneficiaryType"),
      beneficiary:v("beneficiary"),basisAmount:v("basisAmount"),
      ratePercent:v("ratePercent"),currency:v("currency").toUpperCase()
    };
    try{
      await get<Row>(api+module,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(body)});
      setNotice(module==="expenses"?"Expense captured as draft.":"Confidential proposal captured as draft.");
      setPage(0);setModal(null);refresh();
    }catch(e){setError(e instanceof Error?e.message:"Save failed.");}
    finally{setBusy(false);}
  }
  async function details(record:Row){
    setActive(record);setModal("details");setHistory([]);setError("");
    if(module==="commissions")try{
      setHistory(await get<Row[]>(api+"commissions/"+record.id+"/history"));
    }catch{setError("Unable to load confidential history.");}
  }
  async function update(record:Row,status:string){
    setBusy(true);setError("");
    try{
      await get<Row>(api+module+"/"+record.id+"/status",{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({status})});
      setModal(null);setNotice("Record marked "+status.toLowerCase()+".");refresh();
    }catch(e){setError(e instanceof Error?e.message:"Could not change status.");}
    finally{setBusy(false);}
  }
  async function logout(){
    const r=await fetch("/api/auth/logout",{method:"POST"});
    if(r.ok){router.replace("/login");router.refresh();}
    else setError("Sign-out did not revoke your session. Please retry.");
  }
  return <div className="en-app">
    <aside className="en-sidebar">
      <Link className="en-brand" href="/workspace"><span className="en-logo">S</span>
        <span><strong>SHL<span>.</span></strong><small>INTERNATIONAL</small></span></Link>
      <div className="en-edition"><span className="en-dot"/> OPERATIONS OS <span>RESTRICTED</span></div>
      <div className="en-nav-scroll"><p className="en-nav-label">CONNECTED MODULES</p>
        <nav aria-label="Finance navigation">
          {[
            ["/workspace","▦","Overview"],
            ["/workspace/growth/projects","▱","Projects & jobs"],
            ["/workspace/alerts","◉","Due dates & alerts"],
            ["/workspace/enterprise/invoices","▥","Invoices"],
            ["/workspace/costs/expenses","◎","Operational expenses"],
            ...(authorized?[["/workspace/costs/commissions","◆","Commission vault"]]:[]),
            ["/workspace/account","◌","Account security"]
          ].map(([href,symbol,label])=><Link className={"en-nav-item "+
            (href.endsWith("/"+module)?"active":"")} key={href} href={href}>
            <span className="en-nav-symbol">{symbol}</span>{label}</Link>)}
        </nav>
      </div>
      <div className="en-sidebar-bottom"><div className="en-private">◈ Private operational finance</div>
        <div className="en-profile"><span className="en-profile-avatar">{me?.username?.[0]?.toUpperCase()??"?"}</span>
          <span><strong>{me?.username??"Loading"}</strong><small>{me?.role??"Restricted account"}</small></span>
          <button onClick={()=>void logout()} aria-label="Sign out">↗</button>
        </div></div>
    </aside>
    <div className="en-main">
      <header className="en-topbar"><div>SHL Operations <span>/</span> <strong>{title[module]}</strong></div>
        <Link href="/workspace">Dashboard ↗</Link></header>
      <main className="en-content gx-content">
        <div className="en-heading">
          <div><p className="en-eyebrow">{module==="commissions"?"EXPLICITLY AUTHORIZED USERS ONLY":"CONTROLLED FINANCIAL RECORDS"}</p>
            <h1>{title[module]}<span>.</span></h1><p>{desc[module]}</p></div>
          {permitted&&<button className="en-primary" onClick={()=>void create()}>＋ New {module==="expenses"?"expense":"commission"}</button>}
        </div>
        {error&&<div className="en-alert" role="alert">{error}
          <button onClick={()=>{setError("");refresh();}}>Retry</button></div>}
        {notice&&<p className="gx-notice" role="status">{notice}</p>}
        {(!me||authorized===null)&&!error?
          <div className="en-panel en-loading">Verifying financial permissions…</div>:
         !permitted?<div className="en-panel en-restricted">
          <h2>Restricted financial data</h2>
          <p>{module==="commissions"?"Your named account is not in the commission access list. Administrator access alone does not grant permission.":
            "Only authorized financial staff can view operational expenses."}</p></div>:<>
          <section className={"gx-banner "+(module==="commissions"?"cx-vault":"")}>
            <div><span className="gx-kicker">{module==="commissions"?"PRIVATE • EXPLICIT ACCESS":"AUDITABLE FINANCIAL WORKFLOWS"}</span>
              <h2>{module==="commissions"?"Confidential by identity. Accountable by design.":"Know every cost. Protect every margin."}</h2>
              <p>{module==="commissions"?"Commission beneficiary details never appear in ordinary finance reports or audit history.":
                "Track project costs by original currency. No unverified FX conversion or invented profit estimates."}</p></div>
            <div className="gx-metric"><strong>{records.totalElements.toLocaleString()}</strong>
              <small>RECORDS</small></div>
          </section>
          {module==="expenses"&&summary.length>0&&<div className="cx-summary">
            {summary.map(s=><div key={String(s.currency)} className="en-panel cx-summary-card">
              <small>APPROVED EXPENSES · {String(s.currency)}</small>
              <strong>{Number(s.approved).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
              <span>Pending: {Number(s.pending).toLocaleString("en-US",{minimumFractionDigits:2})}</span>
            </div>)}</div>}
          <section className="en-panel gx-list">
            <div className="gx-toolbar"><div><strong>{module==="expenses"?"Expense register":"Restricted commission register"}</strong>
              <span>{records.totalElements} records · no sample financial data</span></div>
              <form className="gx-search" onSubmit={e=>{e.preventDefault();setPage(0);setTerm(q);}}>
                <input aria-label="Search records" placeholder="Search reference or project" value={q} onChange={e=>setQ(e.target.value)}/>
                <button>Search</button>
              </form></div>
            <div className="gx-table-wrap"><table className="gx-table"><thead><tr>
              {columns[module].map(([key,label])=><th key={key}>{label}</th>)}<th>DETAIL</th>
            </tr></thead><tbody>
              {records.content.map(record=><tr key={String(record.id)}>
                {columns[module].map(([key])=><td key={key}>
                  {key==="status"?<span className={"gx-stage gx-"+String(record.status).toLowerCase()}>{txt(record[key])}</span>:
                   ["amount","commission_amount"].includes(key)?Number(record[key]).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):txt(record[key])}
                </td>)}
                <td><button className="gx-open" onClick={()=>void details(record)}>Open ↗</button></td>
              </tr>)}</tbody></table>
              {loading?<p className="gx-loading">Loading protected records…</p>:
                records.content.length===0?<p className="gx-loading">No matching records. Create one to start the audit trail.</p>:null}
            </div>
            <div className="gx-pagination"><span>Showing up to 15 entries</span><div>
              <button disabled={page===0} onClick={()=>setPage(x=>x-1)}>← Previous</button>
              <button disabled={page+1>=records.totalPages} onClick={()=>setPage(x=>x+1)}>Next →</button>
            </div></div>
          </section>
        </>}
      </main>
    </div>
    {modal&&<div className="gx-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}>
      <section className="gx-dialog" role="dialog" aria-modal="true" aria-labelledby="cx-dialog-title">
        <header className="gx-dialog-header"><div><small>{module==="commissions"?"CONFIDENTIAL":"CONTROLLED FINANCE"}</small>
          <h2 id="cx-dialog-title">{modal==="create"?"New "+(module==="expenses"?"project expense":"commission proposal"):txt(active?.reference)}</h2></div>
          <button onClick={()=>setModal(null)} aria-label="Close dialog">×</button>
        </header>
        <div className="gx-dialog-body">
          {error&&<div role="alert" className="en-alert">{error}</div>}
          {modal==="create"?<form className="gx-form" onSubmit={e=>void submit(e)}>
            <Field name="projectId" label="Linked project" required>
              <select required defaultValue="" name="projectId"><option value="">Select active project</option>
                {projects.map(p=><option key={String(p.id)} value={String(p.id)}>
                  {String(p.reference)} · {String(p.title)}</option>)}
              </select>
            </Field>
            {module==="expenses"?<>
              <Field label="Expense category" name="category" required>
                <select name="category" defaultValue="FREIGHT">{["FREIGHT","CUSTOMS","PACKAGING","BANK_FEES","OPERATIONS","OTHER"].map(s=>
                  <option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>
              </Field>
              <Field label="Description" name="description" required/>
              <div className="gx-two"><Field label="Amount" name="amount" type="number" required/>
                <Field label="Currency (ISO)" name="currency" required/></div>
              <Field label="Incurred date" name="incurredOn" type="date" required/>
            </>:<>
              <Field label="Beneficiary type" name="beneficiaryType" required>
                <select name="beneficiaryType" defaultValue="STAFF">{["STAFF","CNEE","KEY_PERSON","OTHER"].map(x=>
                  <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select>
              </Field>
              <Field label="Beneficiary" name="beneficiary" required/>
              <div className="gx-two"><Field label="Commission basis" name="basisAmount" type="number" required/>
                <Field label="Rate (%)" name="ratePercent" type="number" required/></div>
              <Field label="Currency (ISO)" name="currency" required/>
              <p className="en-help">The backend computes commission using decimal arithmetic. It is never derived from browser calculations.</p>
            </>}
            <p className="en-help">A different authorized person must approve a draft. Amounts are not converted between currencies.</p>
            <button className="en-primary" disabled={busy}>{busy?"Saving…":"Save draft →"}</button>
          </form>:active&&<>
            <div className="gx-detail-grid">{Object.entries(active).map(([key,value])=>
              <div key={key}><small>{key.replaceAll("_"," ").toUpperCase()}</small><strong>{txt(value)}</strong></div>)}</div>
            {active.status==="DRAFT"&&<div className="gx-actions"><strong>Review decision</strong><div>
              {["APPROVED",module==="expenses"?"VOID":"CANCELLED"].map(status=>
                <button key={status} disabled={busy||String(active.created_by)===me?.username&&status==="APPROVED"}
                  onClick={()=>void update(active,status)}>{status} ↗</button>)}
              </div></div>}
            {module==="commissions"&&<div className="gx-notes"><h3>Restricted history</h3>
              {history.map((entry,i)=><article key={i}><span>{txt(entry.actor)} · {txt(entry.created_at)}</span>
                <p>{txt(entry.action)} · {txt(entry.detail)}</p></article>)}</div>}
          </>}
        </div>
      </section>
    </div>}
  </div>;
}
