"use client";

import {useCallback,useEffect,useState,type FormEvent} from "react";
import {ShipmentDocumentChecklist} from "./shipment-document-checklist";

type Purchase={id:string;reference:string;status:string;supplier_name:string};
type Shipment={id:string;reference:string;purchase_order_id:string;po_reference:string;
  supplier_name:string;origin:string;destination:string;status:string;etd:string|null;eta:string|null};
type Page={content:Shipment[];totalElements:number};
type Milestone={id:string;event:string;actor:string;notes:string|null;occurred_at:string};
type Details={shipment:Shipment;lines:{id:string;product_name:string;quantity:number;unit:string}[];
  milestones:Milestone[]};
type Role={username:string;role:string};
const route="/api/enterprise/logistics/line-shipments";

async function req<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{cache:"no-store",...init});
  if(response.status===401){window.location.assign("/login");throw new Error("Session expired");}
  if(!response.ok){
    if(response.status===403)throw new Error("Insufficient permission for shipping records.");
    if(response.status===409)throw new Error("Shipment step blocked. Confirm PO approval and current status.");
    throw new Error("Shipment request failed ("+response.status+").");
  }
  return response.json() as Promise<T>;
}

export function LineShipmentPanel({orderId,purchaseOrders,me}:{
  orderId:string;purchaseOrders:Purchase[];me:Role|null
}){
  const [items,setItems]=useState<Shipment[]>([]);
  const [selected,setSelected]=useState<Details|null>(null);
  const [tick,setTick]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [note,setNote]=useState("");
  const reload=useCallback(()=>setTick(n=>n+1),[]);
  useEffect(()=>{
    if(!me||!["ADMIN","MANAGEMENT","SOURCING","LOGISTICS"].includes(me.role))return;
    let mounted=true;
    req<Page>(route+"?salesOrderId="+encodeURIComponent(orderId))
      .then(p=>{if(mounted){setItems(p.content);setError("");}})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:"Unable to load shipments");});
    return()=>{mounted=false;};
  },[orderId,tick,me]);
  const canWrite=!!me&&["ADMIN","MANAGEMENT","LOGISTICS"].includes(me.role);
  const already=new Set(items.map(s=>s.purchase_order_id));

  async function action(path:string,method:"POST"|"PATCH",body:unknown){
    setBusy(true);setError("");
    try{
      const result=await req<Details>(route+path,{method,
        headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      setSelected(result);setNote("");reload();
    }catch(e){setError(e instanceof Error?e.message:"Shipment action failed");}
    finally{setBusy(false);}
  }
  async function open(id:string){
    setBusy(true);setError("");
    try{setSelected(await req<Details>(route+"/"+id));}
    catch(e){setError(e instanceof Error?e.message:"Unable to inspect shipment");}
    finally{setBusy(false);}
  }
  function book(e:FormEvent<HTMLFormElement>,poId:string){
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const value=(field:string)=>String(form.get(field)||"").trim();
    void action("","POST",{
      purchaseOrderId:poId,origin:value("origin"),destination:value("destination"),
      carrier:value("carrier")||null,trackingNumber:value("trackingNumber")||null,
      etd:value("etd")||null,eta:value("eta")||null
    });
  }
  if(!me||!["ADMIN","MANAGEMENT","SOURCING","LOGISTICS"].includes(me.role))return null;

  return <section className="lo-allocations lo-shipment">
    <h3>04 / Shipment booking & milestones</h3>
    <p className="lq-muted">One full-allocation shipment per issued supplier PO.
      Tracking updates are entered by staff, not imported from carriers.</p>
    {error&&<p role="alert" className="lq-error">{error}</p>}
    {purchaseOrders.filter(p=>p.status==="ISSUED"&&!already.has(p.id)).map(po=>
      <form className="lo-shipment-form" key={po.id} onSubmit={e=>book(e,po.id)}>
        <strong>{po.reference} · {po.supplier_name}</strong>
        <div className="lo-shipment-fields">
          <label>Origin *<input name="origin" required maxLength={160} disabled={!canWrite||busy}/></label>
          <label>Destination *<input name="destination" required maxLength={160} disabled={!canWrite||busy}/></label>
          <label>Carrier<input name="carrier" maxLength={160} disabled={!canWrite||busy}/></label>
          <label>Tracking / BL<input name="trackingNumber" maxLength={120} disabled={!canWrite||busy}/></label>
          <label>ETD<input type="date" name="etd" disabled={!canWrite||busy}/></label>
          <label>ETA<input type="date" name="eta" disabled={!canWrite||busy}/></label>
        </div>
        {canWrite&&<button type="submit" disabled={busy} className="lq-action">Book shipment</button>}
      </form>)}
    {items.map(sh=><div className="lo-order" key={sh.id}>
      <div><strong>{sh.reference} · {sh.supplier_name}</strong>
        <small>{sh.status} · {sh.origin} → {sh.destination} · ETA {sh.eta||"not set"}</small>
      </div><button type="button" disabled={busy} onClick={()=>void open(sh.id)}>Milestones →</button>
    </div>)}
    {selected&&<div className="lo-shipment-history">
      <strong>{selected.shipment.reference} / {selected.shipment.status}</strong>
      <p className="lq-muted">{selected.lines.map(l=>
        l.product_name+" — "+l.quantity+" "+l.unit).join(" · ")}</p>
      {selected.milestones.map(m=><p key={m.id}>
        <strong>{m.event}</strong> · {m.actor} · {new Date(m.occurred_at).toLocaleString("en-GB")}
        {m.notes?" — "+m.notes:""}
      </p>)}
      <ShipmentDocumentChecklist key={selected.shipment.id} shipmentId={selected.shipment.id}
        canWrite={canWrite&&selected.shipment.status!=="CANCELLED"}/>
      {canWrite&&["BOOKED","IN_TRANSIT"].includes(selected.shipment.status)&&<>
        <label>Milestone note (optional)<input value={note} maxLength={300}
          onChange={e=>setNote(e.target.value)} disabled={busy}/></label>
        <div className="lo-actions">
          {selected.shipment.status==="BOOKED"&&<>
            <button type="button" disabled={busy} className="lq-action"
              onClick={()=>void action("/"+selected.shipment.id+"/status",
                "PATCH",{status:"IN_TRANSIT",notes:note})}>Record departure</button>
            <button type="button" disabled={busy} className="lq-danger"
              onClick={()=>void action("/"+selected.shipment.id+"/status",
                "PATCH",{status:"CANCELLED",notes:note})}>Cancel shipment</button>
          </>}
          {selected.shipment.status==="IN_TRANSIT"&&
            <button type="button" disabled={busy} className="lq-action"
              onClick={()=>void action("/"+selected.shipment.id+"/status",
                "PATCH",{status:"DELIVERED",notes:note})}>Record delivery</button>}
        </div>
      </>}
    </div>}
  </section>;
}
