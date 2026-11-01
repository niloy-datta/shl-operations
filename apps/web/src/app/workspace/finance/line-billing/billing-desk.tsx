"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

type Eligible={id:string;reference:string;customer_name:string;currency:string;total_amount:number};
type Candidate={id:string;reference:string;customer_name:string;order_reference:string;
  status:string;currency:string;amount:number;due_date:string|null;
  created_by:string;reviewed_by:string|null;review_notes:string|null};
type Line={id:string;product_name:string;unit:string;quantity:number;line_total:number;sell_unit_price:number};
type Details={billing:Candidate;lines:Line[]};
type Page={content:Candidate[];totalPages:number;totalElements:number};
type Me={role:string;username:string};
const base="/api/enterprise/finance/line-billing";
const money=(value:number,unit:string)=>new Intl.NumberFormat("en-US",{
  minimumFractionDigits:2,maximumFractionDigits:2
}).format(Number(value))+" "+unit;
async function get<T>(path:string,init?:RequestInit):Promise<T>{
  const result=await fetch(path,{...init,cache:"no-store"});
  if(result.status===401){window.location.assign("/login");throw new Error("Sign in again.");}
  if(!result.ok){
    if(result.status===403)throw new Error("Finance or management permissions are required.");
    if(result.status===409)throw new Error("Cannot proceed: check shipping completion and approval state.");
    throw new Error("Billing request failed ("+result.status+").");
  }
  return result.json() as Promise<T>;
}
export function BillingDesk(){
  const [me,setMe]=useState<Me|null>(null);
  const [eligible,setEligible]=useState<Eligible[]>([]);
  const [page,setPage]=useState(0);
  const [results,setResults]=useState<Page>({content:[],totalElements:0,totalPages:0});
  const [selected,setSelected]=useState<Details|null>(null);
  const [date,setDate]=useState("");
  const [reviewNotes,setReviewNotes]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [epoch,setEpoch]=useState(0);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let mounted=true;
    get<Me>("/api/data/me")
      .then(x=>{if(mounted)setMe(x);})
      .catch(()=>{if(mounted)setError("Unable to verify user role.");});
    return()=>{mounted=false;};
  },[]);
  useEffect(()=>{
    let mounted=true;
    Promise.all([
      get<Eligible[]>(base+"/eligible-orders"),
      get<Page>(base+"?"+new URLSearchParams({page:String(page),size:"15"}))
    ]).then(([orders,bills])=>{
      if(mounted){setEligible(orders);setResults(bills);setError("");}
    }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:"Unable to load register");})
      .finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[epoch,page]);
  const reload=()=>{setLoading(true);setEpoch(x=>x+1);};
  async function action(path:string,method:"POST"|"PATCH",payload:unknown){
    setBusy(true);setError("");setNotice("");
    try{
      setSelected(await get<Details>(base+path,{
        method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)
      }));
      setNotice("Saved in the internal review register. No invoice sent or ledger posted.");
      reload();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save billing draft");}
    finally{setBusy(false);}
  }
  async function open(id:string){
    setBusy(true);setError("");
    try{setSelected(await get<Details>(base+"/"+id));}
    catch(e){setError(e instanceof Error?e.message:"Could not load candidate");}
    finally{setBusy(false);}
  }
  const manager=!!me&&["ADMIN","MANAGEMENT"].includes(me.role);
  return <main className="lb-shell">
    <header className="lb-header"><div><Link href="/workspace">← SHL Operations</Link>
      <p className="lb-eyebrow">FINANCE CONTROL / DEVELOPMENT</p>
      <h1>Billing review<span>.</span></h1>
      <p>Generate immutable unposted billing candidates from fully delivered line orders,
        then route them for independent management review.</p></div>
      <span className="lb-not-posted">Unposted · internal only</span>
    </header>
    <section className="lb-panel">
      <div className="lb-section-heading"><h2>Eligible delivered sales orders</h2>
        <button type="button" disabled={busy} onClick={reload}>Refresh ↻</button></div>
      {error&&<p className="lb-error" role="alert">{error}</p>}
      {notice&&<p className="lb-success" role="status">{notice}</p>}
      {loading&&<p>Loading source delivery evidence…</p>}
      {!loading&&eligible.length===0&&<p className="lb-muted">
        No fully delivered line orders are available for billing review.</p>}
      <label className="lb-date">Proposed payment due date (optional)
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          disabled={busy}/></label>
      {eligible.map(order=><div key={order.id} className="lb-row">
        <div><strong>{order.reference} · {order.customer_name}</strong>
          <small>Approved sell total: {money(order.total_amount,order.currency)}</small></div>
        <button type="button" disabled={busy}
          onClick={()=>void action("","POST",{salesOrderId:order.id,dueDate:date||null})}>
          Prepare candidate →</button>
      </div>)}
    </section>
    <section className="lb-panel">
      <div className="lb-section-heading"><h2>Internal billing register</h2>
        <span>{results.totalElements} records</span></div>
      {results.content.map(b=><div className="lb-row" key={b.id}>
        <div><strong>{b.reference} · {b.customer_name}</strong>
          <small>{b.status} · {b.order_reference} · {money(b.amount,b.currency)}</small></div>
        <button type="button" disabled={busy} onClick={()=>void open(b.id)}>Review →</button>
      </div>)}
      <div className="lb-pages">
        <button type="button" disabled={busy||page===0} onClick={()=>setPage(n=>n-1)}>Previous</button>
        <span>Page {page+1} / {Math.max(1,results.totalPages)}</span>
        <button type="button" disabled={busy||page+1>=results.totalPages}
          onClick={()=>setPage(n=>n+1)}>Next</button>
      </div>
    </section>
    {selected&&<section className="lb-panel">
      <div className="lb-section-heading"><h2>{selected.billing.reference}</h2>
        <span className="lb-status">{selected.billing.status}</span></div>
      <p className="lb-muted">{selected.billing.customer_name} ·
        {money(selected.billing.amount,selected.billing.currency)} ·
        Prepared by {selected.billing.created_by}</p>
      <div className="lb-tablewrap"><table>
        <thead><tr><th>Product</th><th>Quantity</th><th>Price / unit</th><th>Line total</th></tr></thead>
        <tbody>{selected.lines.map(line=><tr key={line.id}>
          <td>{line.product_name}</td><td>{line.quantity} {line.unit}</td>
          <td>{money(line.sell_unit_price,selected.billing.currency)}</td>
          <td>{money(line.line_total,selected.billing.currency)}</td>
        </tr>)}</tbody>
      </table></div>
      {selected.billing.status==="DRAFT"&&manager&&
        <div className="lb-review">
          <label>Independent review notes (required)
            <textarea rows={3} maxLength={1000} value={reviewNotes}
              onChange={e=>setReviewNotes(e.target.value)} disabled={busy}/></label>
          <div><button type="button" disabled={busy||!reviewNotes.trim()||
            me?.username===selected.billing.created_by}
            onClick={()=>void action("/"+selected.billing.id+"/review","PATCH",{
              decision:"REVIEWED",notes:reviewNotes
            })}>Approve internal review</button>
            <button type="button" disabled={busy||!reviewNotes.trim()||
              me?.username===selected.billing.created_by}
              onClick={()=>void action("/"+selected.billing.id+"/review","PATCH",{
                decision:"VOID",notes:reviewNotes
              })}>Void draft</button>
          </div>
        </div>}
      {selected.billing.reviewed_by&&<p className="lb-muted">
        Reviewed by {selected.billing.reviewed_by}: {selected.billing.review_notes}</p>}
    </section>}
    <footer className="lb-warning">This is not a tax/commercial invoice, accounting
      posting, payment request or proof of customer acceptance. No messages are sent.
      Legal invoice issuance, taxation, general ledger and reconciliation require
      separate approved implementation.</footer>
  </main>;
}
