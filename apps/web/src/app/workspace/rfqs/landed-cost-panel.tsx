"use client";
import { expireWorkspaceSession } from "@/lib/session-client";

import {useCallback,useEffect,useState,type FormEvent} from "react";

type Offer={
  id:string;
  itemId:string;
  productName:string;
  supplierName:string;
  revisionNumber:number;
  incoterm:string|null;
  unit:string;
  unitPrice:number;
};
type Scenario={
  id:string;
  source_revision_id:string;
  source_revision_number:number;
  product_name:string;
  supplier_name:string;
  currency:string;
  unit:string;
  incoterm:string|null;
  quantity:number;
  source_unit_price:number;
  freight:number;
  insurance:number;
  duty:number;
  handling:number;
  estimated_total:number;
  estimated_unit_cost:number;
  assumption_source:string;
  created_at:string;
};
type User={role:string};
const root="/api/trading/rfqs/";

async function load<T>(path:string,init?:RequestInit):Promise<T>
{
  const response=await fetch(path,{cache:"no-store",...init});
  if(response.status===401)
  {
    expireWorkspaceSession();
    throw new Error("Session expired");
  }
  if(!response.ok)
  {
    throw new Error("Request failed ("+response.status+"). Check the latest quote revision, MOQ and RFQ stage.");
  }
  return response.json() as Promise<T>;
}

export function LandedCostPanel({rfqId,currency,offers}:{
  rfqId:string;
  currency:string;
  offers:Offer[];
})
{
  const [records,setRecords]=useState<Scenario[]>([]);
  const [role,setRole]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [tick,setTick]=useState(0);
  const path=root+rfqId+"/landed-cost";
  const refresh=useCallback(()=>setTick(x=>x+1),[]);

  useEffect(()=>
  {
    let active=true;
    Promise.all([load<Scenario[]>(path),load<User>("/api/data/me")])
      .then(([scenarios,user])=>
      {
        if(active)
        {
          setRecords(scenarios);
          setRole(user.role);
          setError("");
        }
      })
      .catch(cause=>{if(active)setError(String(cause));});
    return()=>{active=false;};
  },[path,tick]);

  async function submit(event:FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    const form=event.currentTarget;
    const input=new FormData(form);
    const value=(key:string)=>String(input.get(key)??"").trim();
    setBusy(true);setError("");setNotice("");
    try
    {
      await load<Scenario>(path,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          sourceRevisionId:value("sourceRevisionId"),
          freight:value("freight")||"0.00",
          insurance:value("insurance")||"0.00",
          duty:value("duty")||"0.00",
          handling:value("handling")||"0.00",
          assumptionSource:value("assumptionSource")
        })
      });
      setNotice("Cost assumption saved with its source quote snapshot.");
      form.reset();
      refresh();
    }
    catch(cause){setError(String(cause));}
    finally{setBusy(false);}
  }

  const canWrite=["ADMIN","MANAGEMENT","SOURCING"].includes(role);
  const money=(value:number)=>Number(value).toLocaleString("en-US",{
    minimumFractionDigits:2,maximumFractionDigits:2
  })+" "+currency;

  return <section className="desk-landed" aria-label="Landed-cost scenario analysis">
    <div className="desk-offer-header">
      <div><p className="desk-eyebrow">SOURCING ESTIMATES · CURRENCY-LOCKED</p>
        <h3>Landed-cost comparison</h3></div>
    </div>
    <p className="desk-caution">All entries use the RFQ currency {currency}. Freight, insurance, duty and handling must be sourced separately, and may already be included under some Incoterms. These are assumptions, not landed-cost certificates, customs rates or supplier approvals.</p>
    {error&&<p className="desk-inline-error" role="alert">{error}</p>}
    {notice&&<p className="desk-inline-notice" role="status">{notice}</p>}
    {records.length>0&&<div className="desk-landed-list">
      {records.map(record=><article key={record.id}>
        <div><h4>{record.product_name} · {record.supplier_name}</h4>
          <small>Offer revision {record.source_revision_number} · {record.incoterm??"Incoterm unknown"}</small>
        </div>
        <strong>{money(record.estimated_total)} <small>estimate total</small></strong>
        <p>Unit estimate: {Number(record.estimated_unit_cost).toFixed(4)} {currency} · Quantity: {record.quantity} {record.unit}</p>
        <p>Base: {money(Number(record.source_unit_price)*Number(record.quantity))};
          freight {money(record.freight)}; insurance {money(record.insurance)};
          duty {money(record.duty)}; handling {money(record.handling)}</p>
        <p className="desk-landed-source">Source: {record.assumption_source}</p>
      </article>)}
    </div>}
    {canWrite&&offers.length>0&&<form className="desk-landed-form" onSubmit={submit}>
      <h4>Add an estimate using the latest supplier quote</h4>
      <label>Source supplier offer
        <select name="sourceRevisionId" required>
          {offers.map(offer=><option key={offer.id} value={offer.id}>
            {offer.productName} · {offer.supplierName} · Rev {offer.revisionNumber} · {offer.incoterm??"No incoterm"}
          </option>)}
        </select>
      </label>
      <div className="desk-landed-fields">
        {["freight","insurance","duty","handling"].map(field=><label key={field}>
          {field.charAt(0).toUpperCase()+field.slice(1)} ({currency})
          <input name={field} type="number" min="0" step="0.01" required defaultValue="0.00"/>
        </label>)}
      </div>
      <label>Source and assumptions
        <textarea rows={2} name="assumptionSource" required maxLength={600}
          placeholder="Quote reference, freight source, insurance/duty assumptions and date"/>
      </label>
      <button className="desk-primary" disabled={busy} type="submit">
        {busy?"Recording…":"Save immutable cost scenario"}
      </button>
    </form>}
  </section>;
}
