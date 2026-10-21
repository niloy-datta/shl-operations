"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {LineOrderPanel} from "./line-order-panel";

type Rfq={ id:string;reference:string;subject:string;currency:string;status:string;customerName:string };
type Requirement={id:string;lineNumber:number;productName:string;specifications:string|null;
  quantity:number;unit:string;targetDestination:string|null};
type SupplierPrice={id:string;itemId:string;supplierId:string;supplierName:string;
  revisionNumber:number;unitPrice:number;moq:number;incoterm:string|null;port:string|null;
  leadDays:number};
type Quote={id:string;rfq_id:string;version:number;status:string;currency:string;
  total_cost:number;total_sell:number;gross_contribution:number;created_by:string;
  reviewed_by:string|null;valid_until:string|null;review_notes:string|null};
type QuoteLine={id:string;product_name:string;quantity:number;unit:string;
  supplier_name:string;source_unit_cost:number;sell_unit_price:number;
  cost_total:number;sell_total:number};
type Details={quote:Quote;lines:QuoteLine[]};
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money=(n:number,c:string)=>new Intl.NumberFormat("en-US",{
  minimumFractionDigits:2,maximumFractionDigits:2
}).format(n)+" "+c;
async function json<T>(path:string,init?:RequestInit):Promise<T> {
  const response=await fetch(path,{cache:"no-store",...init});
  if(response.status===401){window.location.assign("/login");throw new Error("Session expired");}
  const value=await response.json().catch(()=>({})) as {detail?:string;message?:string;error?:string};
  if(!response.ok)throw new Error(
    (response.status===403?"Not authorized for this action. ":
      response.status===409?"Workflow restriction: ":"")+
    (value.detail||value.message||value.error||"Request failed ("+response.status+")"));
  return value as unknown as T;
}
const api=(path:string)=>"/api/enterprise/commerce/line-quotes"+path;

export function LineQuoteDesk({rfqId}:{rfqId:string}) {
  const valid=uuidPattern.test(rfqId);
  const [rfq,setRfq]=useState<Rfq|null>(null);
  const [items,setItems]=useState<Requirement[]>([]);
  const [prices,setPrices]=useState<SupplierPrice[]>([]);
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [choices,setChoices]=useState<Record<string,string>>({});
  const [sales,setSales]=useState<Record<string,string>>({});
  const [validUntil,setValidUntil]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(valid);
  const [selected,setSelected]=useState<Details|null>(null);
  const [notes,setNotes]=useState("");
  const [revision,setRevision]=useState(0);

  useEffect(()=>{
    if(!valid)return;
    let active=true;
    Promise.all([
      json<Rfq>("/api/trading/rfqs/"+rfqId),
      json<Requirement[]>("/api/trading/rfqs/"+rfqId+"/items"),
      json<SupplierPrice[]>("/api/trading/rfqs/"+rfqId+"/line-offers"),
      json<Quote[]>(api("?rfqId="+encodeURIComponent(rfqId)))
    ]).then(([r,i,p,q])=>{
      if(active){setRfq(r);setItems(i);setPrices(p);setQuotes(q);setMessage("");}
    }).catch(e=>{if(active)setMessage(e instanceof Error?e.message:"Unable to load quotation");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false};
  },[valid,rfqId,revision]);

  const economics=useMemo(()=>{
    let cost=0,sell=0;
    for(const item of items){
      const picked=prices.find(p=>p.id===choices[item.id]);
      const price=Number(sales[item.id]||0);
      if(!picked||!(price>0))continue;
      cost+=Math.round(item.quantity*Number(picked.unitPrice)*100)/100;
      sell+=Math.round(item.quantity*price*100)/100;
    }
    return {cost,sell,contribution:sell-cost,
      margin:sell>0?(sell-cost)/sell*100:0};
  },[items,prices,choices,sales]);

  async function perform(path:string,body?:unknown) {
    setBusy(true);setMessage("");
    try{
      const result=await json<Details>(api(path),{
        method:"POST",headers:{"content-type":"application/json"},
        body:body===undefined?undefined:JSON.stringify(body)
      });
      setSelected(result);setRevision(n=>n+1);
      return true;
    }catch(e){setMessage(e instanceof Error?e.message:"Request failed");return false;}
    finally{setBusy(false);}
  }

  function create(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!rfq)return;
    const selections=items.map(item=>({
      itemId:item.id,sourceRevisionId:choices[item.id],
      sellUnitPrice:sales[item.id]
    }));
    if(items.length===0||selections.some(x=>!x.sourceRevisionId||!(Number(x.sellUnitPrice)>0))) {
      setMessage("Choose a supplier revision and a selling price for every product line.");
      return;
    }
    if(economics.contribution < -0.001){
      setMessage("Selling prices cannot be below selected supplier cost.");
      return;
    }
    void perform("",{rfqId,validUntil:validUntil||null,items:selections});
  }

  async function loadDetails(id:string){
    setBusy(true);setMessage("");
    try{setSelected(await json<Details>(api("/"+id)));}
    catch(e){setMessage(e instanceof Error?e.message:"Unable to load quote");}
    finally{setBusy(false);}
  }

  return <main className="lq-shell">
    <div className="lq-inner">
      <header className="lq-nav"><Link href="/workspace">SHL<span>.</span> OPERATIONS</Link>
        <div><Link href="/workspace/rfqs">← RFQ Trading Desk</Link>
          <Link href="/workspace/enterprise/quotes">Legacy quotes</Link></div></header>
      <section className="lq-hero">
        <div><p className="lq-eyebrow">SHL INTERNATIONAL / CONTROLLED COMMERCE</p>
          <h1>Customer Quotations<span>.</span></h1>
          <p>Turn verified supplier line prices into a versioned, independently reviewed
            customer quotation. No auto-order or payment execution.</p></div>
        <div className="lq-hero-icon" aria-hidden="true">CQ<span>V14</span></div>
      </section>
      {!valid?<section className="lq-panel"><h2>Open a saved RFQ</h2>
        <p>Open the RFQ Trading Desk and select “Prepare line quotation” from an inquiry.</p>
        <Link className="lq-action" href="/workspace/rfqs">Browse RFQs →</Link>
      </section>:<>
        {message&&<div className="lq-error" role="alert">{message}
          <button type="button" onClick={()=>setMessage("")}>Dismiss</button></div>}
        {loading?<p className="lq-muted">Loading saved customer requirements…</p>:rfq&&<>
          <div className="lq-kpis">
            <article><span>RFQ NUMBER</span><strong>{rfq.reference}</strong></article>
            <article><span>CLIENT</span><strong>{rfq.customerName}</strong></article>
            <article><span>REQUIREMENT LINES</span><strong>{items.length}</strong></article>
            <article><span>STAGE</span><strong>{rfq.status.replaceAll("_"," ")}</strong></article>
          </div>
          <section className="lq-panel">
            <div className="lq-heading"><div><p className="lq-eyebrow">01 / BUILD COMMERCIAL DRAFT</p>
              <h2>{rfq.subject}</h2></div><span className="lq-status">Currency: {rfq.currency}</span></div>
            <p className="lq-muted">Every RFQ line must have a supplier cost source.
              Choose a specific supplier revision before entering the customer selling price.</p>
            <form onSubmit={create}>
              <div className="lq-table-wrap"><table className="lq-table">
                <thead><tr><th>PRODUCT / QUANTITY</th><th>SUPPLIER SOURCE</th><th>SELL PRICE / UNIT</th><th>PROVISIONAL TOTAL</th></tr></thead>
                <tbody>{items.map(item=>{
                  const choicesForLine=prices.filter(p=>p.itemId===item.id);
                  const chosen=choicesForLine.find(p=>p.id===choices[item.id]);
                  return <tr key={item.id}>
                    <td><strong>{item.lineNumber}. {item.productName}</strong>
                      <small>{item.quantity} {item.unit} · {item.specifications||"No specifications"}</small></td>
                    <td><select value={choices[item.id]||""} aria-label={"Supplier quotation for "+item.productName}
                      required disabled={busy} onChange={e=>setChoices(c=>({...c,[item.id]:e.target.value}))}>
                      <option value="">Select verified source</option>
                      {choicesForLine.map(p=><option key={p.id} value={p.id}>
                        {p.supplierName} · rev {p.revisionNumber} · {money(p.unitPrice,rfq.currency)}
                      </option>)}
                    </select>
                      {chosen&&<small>Cost {money(chosen.unitPrice,rfq.currency)} / {item.unit}
                        · MOQ {chosen.moq} · {chosen.incoterm||"Terms unspecified"}</small>}
                      {choicesForLine.length===0&&<small>No supplier price recorded yet</small>}
                    </td>
                    <td><input type="number" min="0.0001" step="0.0001" inputMode="decimal"
                      value={sales[item.id]||""} required disabled={busy} placeholder="0.0000"
                      aria-label={"Customer selling price for "+item.productName}
                      onChange={e=>setSales(v=>({...v,[item.id]:e.target.value}))}/>
                      {chosen&&Number(sales[item.id])>0&&Number(sales[item.id])<Number(chosen.unitPrice)&&
                        <small className="lq-negative">Below supplier cost</small>}
                    </td>
                    <td><strong>{money(item.quantity*Number(sales[item.id]||0),rfq.currency)}</strong>
                      <small>Excludes freight, tax, duty and FX</small></td>
                  </tr>;
                })}</tbody>
              </table></div>
              {items.length===0&&<p className="lq-muted">Add RFQ requirement lines before building a quotation.</p>}
              <div className="lq-summary">
                <div><span>SUPPLIER COST</span><strong>{money(economics.cost,rfq.currency)}</strong></div>
                <div><span>CUSTOMER AMOUNT</span><strong>{money(economics.sell,rfq.currency)}</strong></div>
                <div><span>PROVISIONAL CONTRIBUTION</span>
                  <strong className={economics.contribution<0?"lq-negative":""}>
                    {money(economics.contribution,rfq.currency)}</strong></div>
                <div><span>GROSS MARGIN</span><strong>{economics.margin.toFixed(2)}%</strong></div>
              </div>
              <div className="lq-form-bottom">
                <label>Quotation valid until
                  <input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}
                    disabled={busy}/></label>
                <button className="lq-action" type="submit"
                  disabled={busy||items.length===0||rfq.status!=="SOURCING"||prices.length===0}>
                  {busy?"Processing…":"Create versioned draft →"}</button>
              </div>
            </form>
            <p className="lq-disclaimer">Provisional contribution is selling amount minus selected
              supplier line costs only. It is not landed cost, booked profit or an approved order.</p>
          </section>
          <section className="lq-panel">
            <div className="lq-heading"><div><p className="lq-eyebrow">02 / CONTROLLED REVIEW</p>
              <h2>Quotation version history</h2></div>
              <button className="lq-reload" type="button" disabled={busy}
                onClick={()=>{setLoading(true);setRevision(r=>r+1)}}>Refresh</button>
            </div>
            {quotes.length===0?<p className="lq-muted">No customer line quotation drafts yet.</p>:
              <div className="lq-versions">{quotes.map(q=><div key={q.id} className="lq-version">
                <div><strong>Version {q.version}</strong>
                  <small>{q.status} · by {q.created_by}</small></div>
                <div><strong>{money(q.total_sell,rfq.currency)}</strong>
                  <small>Contribution {money(q.gross_contribution,rfq.currency)}</small></div>
                <button type="button" onClick={()=>void loadDetails(q.id)} disabled={busy}>
                  Open →</button>
              </div>)}</div>}
            {selected&&<div className="lq-review">
              <div className="lq-heading"><div><p className="lq-eyebrow">VERSION {selected.quote.version}</p>
                <h3>{selected.quote.status}</h3></div>
                <strong>{money(selected.quote.total_sell,rfq.currency)}</strong></div>
              <div className="lq-table-wrap"><table className="lq-table">
                <thead><tr><th>PRODUCT</th><th>SUPPLIER</th><th>QUANTITY</th>
                  <th>UNIT COST</th><th>SELL UNIT</th></tr></thead>
                <tbody>{selected.lines.map(line=><tr key={line.id}>
                  <td>{line.product_name}</td><td>{line.supplier_name}</td>
                  <td>{line.quantity} {line.unit}</td>
                  <td>{money(line.source_unit_cost,rfq.currency)}</td>
                  <td>{money(line.sell_unit_price,rfq.currency)}</td>
                </tr>)}</tbody></table></div>
              <div className="lq-review-actions">
                {selected.quote.status==="DRAFT"&&<button type="button" className="lq-action"
                  disabled={busy} onClick={()=>void perform("/"+selected.quote.id+"/submit")}>
                    Submit for independent approval</button>}
                {selected.quote.status==="SUBMITTED"&&<>
                  <label>Reviewer notes<input value={notes} maxLength={1000} disabled={busy}
                    onChange={e=>setNotes(e.target.value)} placeholder="Record review evidence / exception"/></label>
                  <button type="button" disabled={busy||!notes.trim()} className="lq-action"
                    onClick={()=>void perform("/"+selected.quote.id+"/review",
                      {decision:"APPROVED",notes})}>Approve (separate manager)</button>
                  <button type="button" disabled={busy||!notes.trim()} className="lq-danger"
                    onClick={()=>void perform("/"+selected.quote.id+"/review",
                      {decision:"REJECTED",notes})}>Reject</button>
                </>}
                {selected.quote.reviewed_by&&<p>Reviewed by {selected.quote.reviewed_by}.
                  {selected.quote.review_notes&&" "+selected.quote.review_notes}</p>}
              </div>
              <p className="lq-disclaimer">Approvers must be ADMIN or MANAGEMENT
                and cannot review their own quotation. Approved versions can create separately audited line-aware sales orders. Shipment
                and invoice integration still require further approval and development.</p>
            </div>}
          </section>
          <LineOrderPanel rfqId={rfqId} quotes={quotes}/>
        </>}
      </>}
    </div>
  </main>;
}
