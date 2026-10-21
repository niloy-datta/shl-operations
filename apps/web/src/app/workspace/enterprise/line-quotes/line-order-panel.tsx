"use client";

import {useCallback,useEffect,useState} from "react";
import {LineShipmentPanel} from "./line-shipment-panel";

type Role={username:string;role:string};
type LineOrder={id:string;reference:string;status:string;currency:string;
  total_amount:number;created_by:string;confirmed_by:string|null};
type OrderLine={id:string;product_name:string;unit:string;quantity:number;
  supplier_id:string;supplier_name:string;sell_total:number;cost_total:number};
type Purchase={id:string;reference:string;status:string;supplier_id:string;
  supplier_name:string;total_amount:number;currency:string;created_by:string;
  issued_by:string|null};
type OrderDetail={order:LineOrder;lines:OrderLine[];purchaseOrders:Purchase[]};
type Page={content:LineOrder[];totalElements:number};
type Quote={id:string;status:string};
const prefix="/api/enterprise/commerce/line-orders";
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,{...init,cache:"no-store"});
  if(response.status===401){window.location.assign("/login");throw new Error("Session expired");}
  if(!response.ok){
    const payload=await response.json().catch(()=>({})) as {error?:string;detail?:string};
    if(response.status===403)throw new Error("Your staff role cannot perform this operation.");
    if(response.status===409)throw new Error("Workflow blocked. Verify approvals, dates, allocated lines and duplicate POs.");
    throw new Error(payload.detail||payload.error||"Request failed ("+response.status+")");
  }
  return response.json() as Promise<T>;
}
const amount=(v:number,c:string)=>new Intl.NumberFormat("en-US",{
  minimumFractionDigits:2,maximumFractionDigits:2
}).format(Number(v))+" "+c;

export function LineOrderPanel({rfqId,quotes}:{rfqId:string;quotes:Quote[]}){
  const approved=quotes.find(q=>q.status==="APPROVED");
  const [me,setMe]=useState<Role|null>(null);
  const [orders,setOrders]=useState<LineOrder[]>([]);
  const [active,setActive]=useState<OrderDetail|null>(null);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [notice,setNotice]=useState("");
  const reload=useCallback(()=>setRevision(x=>x+1),[]);

  useEffect(()=>{
    let alive=true;
    request<Role>("/api/data/me")
      .then(u=>{if(alive)setMe(u);})
      .catch(()=>{if(alive)setMe(null);});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    let alive=true;
    request<Page>(prefix+"?"+new URLSearchParams({rfqId,size:"50"}))
      .then(data=>{if(alive){setOrders(data.content);setMessage("");}})
      .catch(e=>{if(alive)setMessage(e instanceof Error?e.message:"Failed to load orders");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[rfqId,revision]);

  async function view(id:string){
    setBusy(true);setMessage("");
    try{setActive(await request<OrderDetail>(prefix+"/"+id));}
    catch(e){setMessage(e instanceof Error?e.message:"Could not read order.");}
    finally{setBusy(false);}
  }
  async function mutate(path:string,method:"POST"|"PATCH",payload:unknown){
    setBusy(true);setMessage("");setNotice("");
    try{
      const result=await request<OrderDetail|{purchase:Purchase}>(prefix+path,{
        method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)
      });
      if("order" in result)setActive(result);
      else if(active)setActive(await request<OrderDetail>(prefix+"/"+active.order.id));
      setNotice("Saved and recorded in the operations audit trail.");
      reload();
    }catch(e){setMessage(e instanceof Error?e.message:"Could not save workflow action");}
    finally{setBusy(false);}
  }
  const canCreate=!!me&&["ADMIN","MANAGEMENT","BD"].includes(me.role);
  const canPurchase=!!me&&["ADMIN","MANAGEMENT","SOURCING"].includes(me.role);
  const canApprove=!!me&&["ADMIN","MANAGEMENT"].includes(me.role);
  const supplierChoices=active?Array.from(new Map(active.lines.map(line=>
    [line.supplier_id,{id:line.supplier_id,name:line.supplier_name}]
  )).values()):[];
  const procured=new Set(active?.purchaseOrders.map(p=>p.supplier_id)??[]);

  return <section className="lq-panel lo-panel" aria-label="Line sales and procurement workflow">
    <div className="lq-heading">
      <div><p className="lq-eyebrow">03 / CONTROLLED SALES & PROCUREMENT</p>
        <h2>Sales order → supplier purchase orders</h2>
      </div>
      <button type="button" className="lq-reload" disabled={busy}
        onClick={reload}>Refresh</button>
    </div>
    <p className="lq-muted">Multi-line orders are generated from approved quotation snapshots.
      Each supplier receives its own draft PO. No shipment, invoice or bank transaction is created.</p>
    {message&&<div className="lq-error" role="alert">{message}</div>}
    {notice&&<p className="lo-notice" role="status">{notice}</p>}
    {approved&&canCreate&&orders.length===0&&<button type="button"
      className="lq-action" disabled={busy||loading}
      onClick={()=>void mutate("", "POST",{quoteId:approved.id})}>
      {busy?"Creating…":"Create sales order from approved quote →"}
    </button>}
    {!approved&&orders.length===0&&!loading&&<p className="lq-muted">
      An independently approved quotation is required before sales order creation.</p>}
    {loading&&<p className="lq-muted">Loading line orders…</p>}
    {orders.map(o=><div className="lo-order" key={o.id}>
      <div><strong>{o.reference}</strong><small>{o.status} · {amount(o.total_amount,o.currency)}
        {" · "}Created by {o.created_by}</small></div>
      <button type="button" disabled={busy} onClick={()=>void view(o.id)}>Open workflow →</button>
    </div>)}
    {active&&<div className="lo-details">
      <header><h3>{active.order.reference}</h3><span className="lq-status">{active.order.status}</span></header>
      <div className="lq-table-wrap"><table className="lq-table">
        <thead><tr><th>PRODUCT</th><th>SUPPLIER</th><th>QUANTITY</th><th>SELL TOTAL</th></tr></thead>
        <tbody>{active.lines.map(l=><tr key={l.id}>
          <td>{l.product_name}</td><td>{l.supplier_name}</td>
          <td>{l.quantity} {l.unit}</td>
          <td>{amount(l.sell_total,active.order.currency)}</td>
        </tr>)}</tbody>
      </table></div>
      {active.order.status==="DRAFT"&&canApprove&&
        <div className="lo-actions">
          <button type="button" className="lq-action" disabled={busy||me?.username===active.order.created_by}
            onClick={()=>void mutate("/"+active.order.id+"/status","PATCH",{status:"CONFIRMED"})}>
            Confirm sales order (independent manager)</button>
          <button type="button" className="lq-danger" disabled={busy}
            onClick={()=>void mutate("/"+active.order.id+"/status","PATCH",{status:"CANCELLED"})}>
            Cancel draft</button>
        </div>}
      {active.order.status==="CONFIRMED"&&canPurchase&&
        <div className="lo-allocations"><h3>Supplier allocation</h3>
          {supplierChoices.map(s=><div className="lo-order" key={s.id}>
            <strong>{s.name}</strong>
            {procured.has(s.id)?<span className="lq-muted">PO already created</span>:
              <button type="button" disabled={busy}
                onClick={()=>void mutate("/"+active.order.id+"/purchase-orders",
                  "POST",{supplierId:s.id})}>Create supplier PO →</button>}
          </div>)}
        </div>}
      {active.purchaseOrders.length>0&&<div className="lo-allocations">
        <h3>Purchase order approvals</h3>
        {active.purchaseOrders.map(po=><div className="lo-order" key={po.id}>
          <div><strong>{po.reference} · {po.supplier_name}</strong>
            <small>{po.status} · {amount(po.total_amount,po.currency)} · by {po.created_by}</small></div>
          {po.status==="DRAFT"&&canApprove&&
            <button type="button" disabled={busy||me?.username===po.created_by}
              onClick={()=>void mutate("/purchase-orders/"+po.id+"/status",
                "PATCH",{status:"ISSUED"})}>Approve & issue PO →</button>}
        </div>)}
      </div>}
      <LineShipmentPanel orderId={active.order.id} purchaseOrders={active.purchaseOrders} me={me}/>
      <p className="lq-disclaimer">This development workflow requires independent approvals.
        Shipment booking and staff milestones are available; external tracking, documents, invoicing and payments are not connected.</p>
    </div>}
  </section>;
}
