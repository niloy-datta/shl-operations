"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Module = "quotes" | "orders" | "purchase-orders" | "shipments" | "invoices" | "tasks" | "staff" | "audit";
type Row = Record<string, unknown>;
type Page = { content: Row[]; totalElements: number; totalPages: number };
type User = { username: string; role: string };
type Config = { name: string; subtitle: string; endpoint: string; columns: { key: string; label: string }[]; roles: string[]; create: string; search?: boolean; };
const allRoles = ["ADMIN", "MANAGEMENT", "BD", "SOURCING", "LOGISTICS", "FINANCE"];
const moduleConfig: Record<Module, Config> = {
  quotes: {
    name: "Customer quotations", subtitle: "Manage commercial quotes, revisions and approval decisions.",
    endpoint: "commerce/quotes", roles: ["ADMIN","MANAGEMENT","BD","SOURCING"], create: "Create quotation", search: true,
    columns: [{key:"rfq_reference",label:"RFQ"}, {key:"customer_name",label:"CUSTOMER"}, {key:"unit_price",label:"UNIT PRICE"}, {key:"currency",label:"CURRENCY"}, {key:"version",label:"VERSION"}, {key:"status",label:"STATUS"}]
  },
  orders: {
    name:"Sales orders", subtitle:"Turn approved customer quotes into traceable sales orders.",
    endpoint:"commerce/orders", roles:["ADMIN","MANAGEMENT","BD","SOURCING"], create:"Create sales order",search:true,
    columns:[{key:"reference",label:"ORDER"},{key:"customer_name",label:"CUSTOMER"},{key:"total_amount",label:"TOTAL"},{key:"currency",label:"CURRENCY"},{key:"status",label:"STATUS"}]
  },
  "purchase-orders": {
    name:"Purchase orders",subtitle:"Issue supplier purchases against confirmed customer orders.",
    endpoint:"commerce/purchase-orders",roles:["ADMIN","MANAGEMENT","SOURCING"],create:"Create purchase order",search:true,
    columns:[{key:"reference",label:"PURCHASE ORDER"},{key:"supplier_name",label:"SUPPLIER"},{key:"sales_reference",label:"SALES ORDER"},{key:"total_amount",label:"TOTAL"},{key:"status",label:"STATUS"}]
  },
  shipments: {
    name:"Shipments",subtitle:"Track bookings, transit, delivery and immutable milestone events.",
    endpoint:"logistics/shipments",roles:["ADMIN","MANAGEMENT","LOGISTICS","SOURCING"],create:"Book shipment",search:true,
    columns:[{key:"reference",label:"SHIPMENT"},{key:"sales_reference",label:"SALES ORDER"},{key:"origin",label:"ORIGIN"},{key:"destination",label:"DESTINATION"},{key:"eta",label:"ETA"},{key:"status",label:"STATUS"}]
  },
  invoices: {
    name:"Finance & invoices",subtitle:"Currency-aware invoices, payment allocation and outstanding balances.",
    endpoint:"finance/invoices",roles:["ADMIN","MANAGEMENT","FINANCE"],create:"Create invoice",search:true,
    columns:[{key:"reference",label:"INVOICE"},{key:"invoice_type",label:"TYPE"},{key:"sales_reference",label:"SALES ORDER"},{key:"amount",label:"AMOUNT"},{key:"paid_amount",label:"PAID"},{key:"currency",label:"CURRENCY"},{key:"status",label:"STATUS"}]
  },
  tasks: {
    name:"Team tasks",subtitle:"Assign operational work with ownership, deadlines and linked records.",
    endpoint:"tasks",roles:allRoles,create:"Assign task",
    columns:[{key:"title",label:"TASK"},{key:"assignee_name",label:"ASSIGNEE"},{key:"priority",label:"PRIORITY"},{key:"due_date",label:"DUE DATE"},{key:"status",label:"STATUS"}]
  },
  staff: {
    name:"Staff & access",subtitle:"Provision named accounts and change role or access status.",
    endpoint:"staff",roles:["ADMIN"],create:"Add staff member",
    columns:[{key:"username",label:"USERNAME"},{key:"role",label:"ROLE"},{key:"enabled",label:"ENABLED"},{key:"created_at",label:"CREATED"}]
  },
  audit: {
    name:"Audit trail",subtitle:"Review append-only operational activity events and accountable actors.",
    endpoint:"audit",roles:["ADMIN","MANAGEMENT"],create:"",
    columns:[{key:"actor",label:"ACTOR"},{key:"action",label:"ACTION"},{key:"entity_type",label:"RESOURCE"},{key:"detail",label:"DETAIL"},{key:"created_at",label:"TIME"}]
  }
};
const nav: { label: string; url: string; symbol: string; roles?: string[] }[] = [
  {label:"Overview",url:"/workspace",symbol:"▦"},
  {label:"Customers",url:"/workspace?view=customers",symbol:"♙"},
  {label:"Suppliers",url:"/workspace?view=suppliers",symbol:"◇"},
  {label:"RFQ sourcing",url:"/workspace/rfqs",symbol:"▤"},
  {label:"Due dates & alerts",url:"/workspace/alerts",symbol:"◉"},
  {label:"Lead pipeline",url:"/workspace/growth/leads",symbol:"✧",roles:["ADMIN","MANAGEMENT","BD"]},
  {label:"Projects & jobs",url:"/workspace/growth/projects",symbol:"▱"},
  {label:"Quotations",url:"/workspace/enterprise/quotes",symbol:"◈",roles:moduleConfig.quotes.roles},
  {label:"Sales orders",url:"/workspace/enterprise/orders",symbol:"▣",roles:moduleConfig.orders.roles},
  {label:"Purchase orders",url:"/workspace/enterprise/purchase-orders",symbol:"⬡",roles:moduleConfig["purchase-orders"].roles},
  {label:"Shipments",url:"/workspace/enterprise/shipments",symbol:"⇢",roles:moduleConfig.shipments.roles},
  {label:"Finance",url:"/workspace/enterprise/invoices",symbol:"▥",roles:moduleConfig.invoices.roles},
  {label:"Expenses",url:"/workspace/costs/expenses",symbol:"◎",roles:moduleConfig.invoices.roles},
  {label:"Project contribution",url:"/workspace/costs/profitability",symbol:"◴",roles:moduleConfig.invoices.roles},
  {label:"Team tasks",url:"/workspace/enterprise/tasks",symbol:"☷",roles:moduleConfig.tasks.roles},
  {label:"Staff",url:"/workspace/enterprise/staff",symbol:"♧",roles:moduleConfig.staff.roles},
  {label:"Audit trail",url:"/workspace/enterprise/audit",symbol:"⊞",roles:moduleConfig.audit.roles},
  {label:"My security",url:"/workspace/account",symbol:"◌"}
];
const titles: Record<string,string> = {
  DRAFT:"Draft",SUBMITTED:"Submitted",APPROVED:"Approved",REJECTED:"Rejected",
  CONFIRMED:"Confirmed",IN_PROGRESS:"In progress",COMPLETED:"Completed",CANCELLED:"Cancelled",
  ISSUED:"Issued",RECEIVED:"Received",BOOKED:"Booked",IN_TRANSIT:"In transit",
  DELIVERED:"Delivered",RECEIVABLE:"Receivable",PAYABLE:"Payable",PAID:"Paid",VOID:"Void",
  TODO:"To do",DONE:"Done",LOW:"Low",NORMAL:"Normal",HIGH:"High"
};
const asText = (v: unknown) => v === null || v === undefined || v === "" ? "—" : String(v);
const pretty = (v: unknown, key: string) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key.endsWith("_at") || key.endsWith("_date") || ["etd","eta","ata","atd","valid_until"].includes(key)) {
    const date = new Date(String(v));
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  }
  if (typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v) && ["unit_price","quantity","total_amount","amount","paid_amount"].includes(key))) {
    return new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(Number(v));
  }
  return titles[String(v)] ?? String(v);
};
const base = "/api/enterprise/";
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path.startsWith("/") ? path : base + path,{cache:"no-store",...options});
  if (res.status===401) { window.location.assign("/login"); throw new Error("Session expired."); }
  if (!res.ok) {
    const body=await res.json().catch(()=>({}));
    if (res.status===403) throw new Error("Your account is not permitted to perform this action.");
    if (res.status===409) throw new Error("Business rule conflict. Check the record status, links or duplicates.");
    if (res.status===400) throw new Error("Please check the entered values and linked records.");
    throw new Error(typeof body.error==="string" ? body.error : "Request failed ("+res.status+").");
  }
  return res.json() as Promise<T>;
}
const send = <T,>(path:string, method:"POST"|"PATCH", payload:Row) => api<T>(path,{
  method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)
});
function statuses(currentModule:Module,row:Row,role:string,username:string): string[] {
  const state=String(row.status??"");
  switch(currentModule) {
    case "quotes": {
      if (state==="DRAFT") return ["SUBMITTED"];
      if (state!=="SUBMITTED" || !["ADMIN","MANAGEMENT"].includes(role)) return [];
      const expires=row.valid_until && String(row.valid_until)<new Date().toISOString().slice(0,10);
      const independent=String(row.created_by)!==username;
      return independent && !expires ? ["APPROVED","REJECTED"] : ["REJECTED"];
    }
    case "orders": if (!["ADMIN","MANAGEMENT","BD"].includes(role)) return []; return state==="DRAFT"?["CONFIRMED","CANCELLED"]:
      state==="CONFIRMED"?["IN_PROGRESS","CANCELLED"]:
      state==="IN_PROGRESS"?["COMPLETED"]:[];
    case "purchase-orders": return state==="DRAFT"?["ISSUED","CANCELLED"]:state==="ISSUED"?["RECEIVED"]:[];
    case "shipments":return state==="BOOKED"?["IN_TRANSIT","CANCELLED"]:state==="IN_TRANSIT"?["DELIVERED"]:[];
    case "invoices":return state==="DRAFT"?["ISSUED","VOID"]:state==="ISSUED"?["VOID"]:[];
    case "tasks":return state==="TODO"?["IN_PROGRESS"]:
      state==="IN_PROGRESS"?["TODO","DONE"]:
      state==="DONE" && ["ADMIN","MANAGEMENT"].includes(role)?["IN_PROGRESS"]:[];
    default:return [];
  }
}
function RowBadge({value}:{value:unknown}) {
  const state=String(value??"");
  return <span className={"en-badge en-state-"+state.toLowerCase()}>{titles[state]??asText(value)}</span>;
}
function FormField({name,label,type="text",required=false,children,placeholder,defaultValue}:{
  name:string;label:string;type?:string;required?:boolean;children?:ReactNode;placeholder?:string;defaultValue?:string;
}) {
  return <label className="en-field"><span>{label}{required && " *"}</span>
    {children??<input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue}
      step={type==="number"?"any":undefined} min={type==="number"?"0.0001":undefined} />}
  </label>;
}
function Select({name,label,options,required=true,onChange,placeholder="Select record"}:{
  name:string;label:string;options:{id:string;text:string}[];required?:boolean;
  onChange?:(value:string)=>void;placeholder?:string;
}) {
  return <FormField name={name} label={label} required={required}>
    <select name={name} required={required} defaultValue="" onChange={e=>onChange?.(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(item=><option key={item.id} value={item.id}>{item.text}</option>)}
    </select></FormField>;
}
export function EnterpriseDesk({currentModule:moduleName}:{currentModule:string}) {
  const currentModule = moduleName as Module;
  const config=moduleConfig[currentModule];
  const router=useRouter();
  const [user,setUser]=useState<User|null>(null);
  const [commissionAccess,setCommissionAccess]=useState(false);
  useEffect(()=>{
    let live=true;
    fetch("/api/costs/commissions/access",{cache:"no-store"})
      .then(res=>res.ok?res.json():{allowed:false})
      .then((x:{allowed:boolean})=>{if(live)setCommissionAccess(x.allowed===true);})
      .catch(()=>{});
    return()=>{live=false;};
  },[]);
  const [page,setPage]=useState(0);
  const [query,setQuery]=useState("");
  const [term,setTerm]=useState("");
  const [tick,setTick]=useState(0);
  const [list,setList]=useState<Page>({content:[],totalElements:0,totalPages:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [modal,setModal]=useState<"create"|"payment"|"access"|"details"|null>(null);
  const [active,setActive]=useState<Row|null>(null);
  const [refs,setRefs]=useState<Record<string,Row[]>>({});
  const [chosenOrder,setChosenOrder]=useState("");
  const [invoiceType,setInvoiceType]=useState("RECEIVABLE");
  const [busy,setBusy]=useState(false);
  const [detail,setDetail]=useState<Row[]>([]);
  const [summary,setSummary]=useState<Row|null>(null);
  const refresh=useCallback(()=>setTick(v=>v+1),[]);

  useEffect(()=>{
    let live=true;
    api<User>("/api/data/me").then(u=>{if(live)setUser(u);}).catch(e=>{if(live)setError(String(e));});
    return ()=>{live=false;};
  },[]);

  useEffect(()=>{
    if (!user || !config.roles.includes(user.role)) return;
    let live=true;
    const frame=requestAnimationFrame(()=>setLoading(true));
    const qp=new URLSearchParams({page:String(page),size:"15"});
    if(config.search) qp.set("q",term);
    Promise.all([
      api<Page>(config.endpoint+"?"+qp.toString()),
      currentModule==="invoices"?api<Row>("finance/summary"):Promise.resolve(null)
    ]).then(([items,stats])=>{
      if(!live)return;
      setList(items);setSummary(stats);setError("");
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:"Unable to load records");})
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;cancelAnimationFrame(frame);};
  },[user,config,currentModule,page,term,tick]);

  async function logout() {
    await fetch("/api/auth/logout",{method:"POST"});
    router.replace("/login");
    router.refresh();
  }
  async function openCreate() {
    setModal("create");setActive(null);setError("");setChosenOrder("");setInvoiceType("RECEIVABLE");
    const requirements:Record<Module,string[]> = {
      quotes:["rfqs"],orders:["quotes"],"purchase-orders":["orders"],shipments:["orders","purchase-orders"],
      invoices:["orders","purchase-orders"],tasks:["staff","rfqs","orders","shipments"],staff:[],audit:[]
    };
    const requests:Record<string,string> = {
      rfqs:"/api/trading/rfqs?page=0&size=100",quotes:"commerce/quotes?size=100",
      orders:"commerce/orders?size=100","purchase-orders":"commerce/purchase-orders?size=100",
      shipments:"logistics/shipments?size=100",staff:"staff/options"
    };
    try {
      const keys=requirements[currentModule];
      const results=await Promise.all(keys.map(async key=>{
        const response=await api<Page|Row[]>(requests[key]);
        return [key,Array.isArray(response)?response:response.content] as const;
      }));
      setRefs(Object.fromEntries(results));
    } catch(e) {setError(e instanceof Error?e.message:"Cannot load linked records");}
  }
  async function selectOrder(id:string) {
    setChosenOrder(id);
    if (currentModule!=="purchase-orders") return;
    const order=refs.orders?.find(item=>asText(item.id)===id);
    if(!order)return;
    try {
      const offers=await api<Row[]>("/api/trading/rfqs/"+order.rfq_id+"/offers");
      setRefs(v=>({...v,offers}));
    }catch(e){setError(e instanceof Error?e.message:"Could not load supplier offers");}
  }
  async function showDetails(row:Row) {
    setActive(row);setModal("details");setDetail([]);
    const id=String(row.id);
    const route=currentModule==="shipments"?"logistics/shipments/"+id+"/milestones":
      currentModule==="invoices"?"finance/invoices/"+id+"/payments":null;
    if(route)try{setDetail(await api<Row[]>(route));}catch(e){setError(String(e));}
  }
  async function createRecord(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    const form=new FormData(event.currentTarget);
    const val=(key:string)=>String(form.get(key)??"").trim();
    let payload:Row={};
    if(currentModule==="quotes") payload={rfqId:val("rfqId"),unitPrice:val("unitPrice"),validUntil:val("validUntil")||null};
    if(currentModule==="orders") payload={quoteId:val("quoteId")};
    if(currentModule==="purchase-orders") payload={salesOrderId:val("salesOrderId"),supplierOfferId:val("supplierOfferId"),quantity:val("quantity")};
    if(currentModule==="shipments") payload={salesOrderId:val("salesOrderId"),purchaseOrderId:val("purchaseOrderId")||null,
      origin:val("origin"),destination:val("destination"),carrier:val("carrier")||null,
      trackingNumber:val("trackingNumber")||null,etd:val("etd")||null,eta:val("eta")||null};
    if(currentModule==="invoices") payload={salesOrderId:val("salesOrderId"),purchaseOrderId:val("purchaseOrderId")||null,
      invoiceType:val("invoiceType"),amount:val("amount"),dueDate:val("dueDate")||null};
    if(currentModule==="tasks") payload={title:val("title"),description:val("description")||null,assigneeId:val("assigneeId"),
      rfqId:val("rfqId")||null,salesOrderId:val("salesOrderId")||null,shipmentId:val("shipmentId")||null,
      dueDate:val("dueDate")||null,priority:val("priority")};
    if(currentModule==="staff") payload={username:val("username"),password:val("password"),role:val("role")};
    try {
      await send<Row>(config.endpoint,"POST",payload);
      setModal(null);setNotice("Record created successfully.");setPage(0);refresh();
    }catch(e){setError(e instanceof Error?e.message:"Could not save record");}
    finally{setBusy(false);}
  }
  async function changeStatus(row:Row,status:string) {
    setBusy(true);setError("");
    try {
      const id=String(row.id);
      await send<Row>(config.endpoint+"/"+id+"/status","PATCH",{status});
      setNotice("Updated "+asText(row.reference??row.title??row.id)+" to "+(titles[status]??status)+".");
      setModal(null);refresh();
    }catch(e){setError(e instanceof Error?e.message:"Could not update status");}
    finally{setBusy(false);}
  }
  async function addPayment(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!active)return;
    setBusy(true);setError("");
    const form=new FormData(event.currentTarget);
    try{
      await send<Row>("finance/invoices/"+active.id+"/payments","POST",{
        reference:String(form.get("reference")??"").trim(),
        amount:String(form.get("amount")??"").trim(),
        paidOn:String(form.get("paidOn")??"")
      });
      setModal(null);setNotice("Payment recorded against invoice.");refresh();
    }catch(e){setError(e instanceof Error?e.message:"Cannot record payment");}
    finally{setBusy(false);}
  }
  async function changeAccess(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!active)return;
    setBusy(true);setError("");
    const form=new FormData(event.currentTarget);
    try{
      await send<Row>("staff/"+active.id+"/access","PATCH",{
        role:String(form.get("role")??""),enabled:form.get("enabled")==="on"
      });
      setModal(null);setNotice("Staff permissions updated.");refresh();
    }catch(e){setError(e instanceof Error?e.message:"Could not change access");}
    finally{setBusy(false);}
  }
  const allowed=user && config.roles.includes(user.role);
  const canCreate=!!user && (currentModule==="tasks" ? ["ADMIN","MANAGEMENT"].includes(user.role) :
    currentModule==="quotes" || currentModule==="orders" ? ["ADMIN","MANAGEMENT","BD"].includes(user.role) :
    currentModule==="staff" ? user.role==="ADMIN" : !!allowed);
  const total=list.totalElements;
  const orderChoices=(refs.orders??[]).filter(item=>!["DRAFT","CANCELLED"].includes(String(item.status)));
  const poChoices=(refs["purchase-orders"]??[]).filter(item=>item.sales_order_id===chosenOrder || currentModule==="invoices");
  const selectOptions=(rows:Row[],field="reference",extra="")=>rows.map(row=>({
    id:String(row.id),text:String(row[field]??row.id)+(extra && row[extra]?" · "+row[extra]:"")
  }));
  const renderFields=()=>{
    switch(currentModule) {
      case "quotes":return <>
        <Select name="rfqId" label="RFQ ready for quotation" options={selectOptions((refs.rfqs??[]).filter(r=>r.status==="READY_FOR_QUOTE"),"reference","subject")} />
        <FormField name="unitPrice" label="Customer unit selling price" type="number" required />
        <FormField name="validUntil" label="Valid until" type="date"/>
        <p className="en-help">Currency and quantity are copied from the linked RFQ. An independent management/admin account must approve. The quote creator cannot approve their own work.</p>
      </>;
      case "orders":return <>
        <Select name="quoteId" label="Approved customer quotation"
          options={selectOptions((refs.quotes??[]).filter(q=>q.status==="APPROVED"),"id")} />
        <p className="en-help">Sales order totals are calculated from the approved quote, not entered manually.</p>
      </>;
      case "purchase-orders":return <>
        <Select name="salesOrderId" label="Confirmed sales order" onChange={value=>void selectOrder(value)}
          options={selectOptions(orderChoices.filter(r=>["CONFIRMED","IN_PROGRESS"].includes(String(r.status))))} />
        <Select name="supplierOfferId" label="Supplier offer linked to this RFQ"
          options={(refs.offers??[]).map(o=>({id:String(o.id),text:String(o.supplierName??o.supplier_name??o.id)+" · "+o.unitPrice+" / "+o.moq+" MOQ"}))}/>
        <FormField name="quantity" label="Purchase quantity (must meet MOQ)" type="number" required />
        <p className="en-help">Supplier currency, unit price and total are captured from the offer.</p>
      </>;
      case "shipments":return <>
        <Select name="salesOrderId" label="Sales order" options={selectOptions(orderChoices)}
          onChange={setChosenOrder} />
        <Select name="purchaseOrderId" label="Purchase order (optional)" required={false}
          placeholder="No purchase order" options={selectOptions(poChoices.filter(r=>r.sales_order_id===chosenOrder))}/>
        <div className="en-form-grid">
          <FormField name="origin" label="Origin" required placeholder="Qingdao, China"/>
          <FormField name="destination" label="Destination" required placeholder="Destination port"/>
        </div>
        <div className="en-form-grid">
          <FormField name="carrier" label="Carrier"/><FormField name="trackingNumber" label="Tracking / BL reference"/>
        </div>
        <div className="en-form-grid"><FormField name="etd" label="ETD" type="date"/><FormField name="eta" label="ETA" type="date"/></div>
      </>;
      case "invoices":return <>
        <Select name="salesOrderId" label="Sales order" options={selectOptions(orderChoices)} onChange={setChosenOrder} />
        <FormField name="invoiceType" label="Invoice type" required><select name="invoiceType" value={invoiceType} onChange={e=>setInvoiceType(e.target.value)}>
          <option value="RECEIVABLE">Customer receivable</option><option value="PAYABLE">Supplier payable</option></select></FormField>
        {invoiceType==="PAYABLE"&&<Select name="purchaseOrderId" label="Issued purchase order"
          options={selectOptions(poChoices.filter(r=>r.sales_order_id===chosenOrder && ["ISSUED","RECEIVED"].includes(String(r.status))))}/>}
        <div className="en-form-grid"><FormField name="amount" label="Invoice amount" type="number" required/>
          <FormField name="dueDate" label="Due date" type="date"/></div>
        <p className="en-help">The amount cannot exceed the linked order balance. Currency is inherited; no FX conversion is performed.</p>
      </>;
      case "tasks":return <>
        <FormField name="title" label="Task title" required placeholder="Follow up on supplier quotation"/>
        <FormField name="description" label="Description"/>
        <Select name="assigneeId" label="Assign to staff" options={selectOptions(refs.staff??[],"username")}/>
        <div className="en-form-grid">
          <FormField name="priority" label="Priority" required><select name="priority" defaultValue="NORMAL"><option>LOW</option><option>NORMAL</option><option>HIGH</option></select></FormField>
          <FormField name="dueDate" label="Due date" type="date"/>
        </div>
        <p className="en-help">Optional linked record: select no more than one.</p>
        <Select name="rfqId" label="Linked RFQ" required={false} placeholder="None" options={selectOptions(refs.rfqs??[],"reference")}/>
        <Select name="salesOrderId" label="Linked sales order" required={false} placeholder="None" options={selectOptions(refs.orders??[])}/>
        <Select name="shipmentId" label="Linked shipment" required={false} placeholder="None" options={selectOptions(refs.shipments??[])}/>
      </>;
      case "staff":return <>
        <FormField name="username" label="Unique username" required placeholder="jane.doe"/>
        <FormField name="password" label="Initial password (16+ characters)" type="password" required/>
        <FormField name="role" label="Role" required><select name="role" defaultValue="BD">
          {allRoles.map(role=><option value={role} key={role}>{role}</option>)}
        </select></FormField>
        <p className="en-help">Use a unique temporary password and require the staff member to change it. MFA is not implemented yet.</p>
      </>;
      default:return null;
    }
  };

  return <div className="en-app">
    <aside className="en-sidebar">
      <Link href="/workspace" className="en-brand"><span className="en-logo">S</span><span><strong>SHL<span>.</span></strong><small>INTERNATIONAL</small></span></Link>
      <div className="en-edition"><span className="en-dot" /> OPERATIONS OS <span>ENTERPRISE</span></div>
      <div className="en-nav-scroll"><p className="en-nav-label">OPERATIONS WORKSPACE</p>
        <nav aria-label="Business modules">{nav.filter(item=>!item.roles||!user||item.roles.includes(user.role)).concat(
          commissionAccess?[{label:"Commission vault",url:"/workspace/costs/commissions",symbol:"◆"}]:[]
        ).map(item=>
          <Link key={item.url} href={item.url} className={"en-nav-item "+(item.url.endsWith("/"+currentModule)?"active":"")}>
            <span className="en-nav-symbol">{item.symbol}</span><span>{item.label}</span>
            {item.url.endsWith("/"+currentModule)&&<span className="en-current-dot"/>}
          </Link>)}</nav></div>
      <div className="en-sidebar-bottom">
        <div className="en-private">◈ &nbsp; Private business workspace</div>
        <div className="en-profile"><span className="en-profile-avatar">{user?.username?.slice(0,1).toUpperCase()??"?"}</span>
          <span><strong>{user?.username??"Loading"}</strong><small>{user?.role??"Staff account"}</small></span>
          <button title="Sign out" aria-label="Sign out" onClick={()=>void logout()}>↗</button></div>
      </div>
    </aside>
    <div className="en-main">
      <header className="en-topbar"><div>SHL Operations <span>/</span> <strong>{config.name}</strong></div>
        <div className="en-top-actions"><span className="en-private-pill"><i/> PRIVATE WORKSPACE</span>
          <Link href="/workspace">Overview ↗</Link></div></header>
      <main className="en-content">
        <div className="en-heading"><div><p className="en-eyebrow">SHL INTERNATIONAL <span>/</span> ENTERPRISE WORKFLOWS</p>
          <h1>{config.name}<span>.</span></h1><p>{config.subtitle}</p></div>
          {allowed && canCreate && config.create &&
            <button className="en-primary" onClick={()=>void openCreate()}><span>＋</span> {config.create}</button>}</div>
        {!user && !error ? <div className="en-panel en-loading">Checking workspace permissions…</div> :
        !allowed ? <div className="en-panel en-restricted"><span>◇</span><h2>Access restricted</h2>
          <p>Your account does not have access to this currentModule. Contact an administrator if your responsibilities require it.</p>
          <Link href="/workspace">Return to dashboard →</Link></div> :
        <>
          <div className="en-intro">
            <div><span className="en-intro-kicker">CONTROLLED OPERATIONS · TRACEABLE WORKFLOWS</span>
              <h2>From inquiry to execution<span>.</span></h2>
              <p>Every record is linked, every transition follows business rules, and saved changes are attributed to staff.</p></div>
            <div className="en-orb" aria-hidden="true"><div><strong>SHL</strong><small>OPERATIONS</small></div></div>
          </div>
          {error && <div className="en-alert" role="alert">{error}<button onClick={()=>{setError("");refresh();}}>Retry</button></div>}
          {notice && <div className="en-success" role="status">✓ {notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice">×</button></div>}
          <div className="en-metrics"><div className="en-metric"><span>RECORDS IN MODULE</span><strong>{loading?"—":total.toLocaleString()}</strong><small>From secure database</small></div>
            <div className="en-metric"><span>WORKFLOW</span><strong className="en-metric-label">Linked</strong><small>All writes are validated by the API</small></div>
            <div className="en-metric"><span>ACCESS LEVEL</span><strong className="en-metric-label">{user?.role}</strong><small>Server-enforced permissions</small></div></div>
          {currentModule==="invoices" && summary && <div className="en-finance-summary">
            <h2>Finance by currency</h2><p>Issued invoices only. No currencies are combined or converted.</p>
            {(["receivables","payables"] as const).map(type=><div key={type}><strong>{type==="receivables"?"Receivables":"Payables"}</strong>
              {((summary[type] as Row[])??[]).length===0?<span>No issued invoices</span>:
                ((summary[type] as Row[])??[]).map((r,i)=><span key={i}>{asText(r.currency)} · {pretty(r.remaining,"amount")} outstanding</span>)}</div>)}
          </div>}
          <section className="en-panel en-directory">
            <div className="en-panel-header"><div><p className="en-eyebrow">OPERATIONS RECORDS</p><h2>{config.name} directory</h2><small>{loading?"Loading…":total+" saved records"}</small></div>
              <div className="en-tools">
                {config.search&&<form onSubmit={e=>{e.preventDefault();setPage(0);setTerm(query);}}>
                  <span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search records" placeholder="Search reference or name"/><button>Find</button></form>}
                <button className="en-tool-icon" title="Refresh" aria-label="Refresh" onClick={refresh}>↻</button>
              </div></div>
            <div className="en-table-scroll"><table><thead><tr>{config.columns.map(col=><th key={col.key}>{col.label}</th>)}<th>ACTIONS</th></tr></thead>
              <tbody>{!loading && list.content.map((record,index)=><tr key={String(record.id??index)}>
                {config.columns.map(col=><td key={col.key}>{col.key==="status"||col.key==="priority"||col.key==="invoice_type"?
                  <RowBadge value={record[col.key]}/>:
                  <span className={["reference","title","username"].includes(col.key)?"en-strong":""}>{pretty(record[col.key],col.key)}</span>}</td>)}
                <td><button className="en-action" onClick={()=>void showDetails(record)}>Details ↗</button>
                  {currentModule==="staff"&&<button className="en-action" onClick={()=>{setActive(record);setModal("access");}}>Access</button>}
                  {currentModule==="invoices"&&record.status==="ISSUED"&&<button className="en-action" onClick={()=>{setActive(record);setModal("payment");}}>Pay</button>}
                </td></tr>)}</tbody></table>
              {loading&&<div className="en-table-empty">Loading your records…</div>}
              {!loading && list.content.length===0&&<div className="en-table-empty"><span>◇</span><h3>No records found</h3>
                <p>{term?"Try a different search.":"Create your first record to begin this workflow. No demo entries are inserted."}</p></div>}
            </div>
            <div className="en-pagination"><span>Page {page+1} / {Math.max(1,list.totalPages)}</span><div>
              <button disabled={page===0||loading} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous</button>
              <button disabled={page+1>=list.totalPages||loading} onClick={()=>setPage(p=>p+1)}>Next</button>
            </div></div>
          </section>
          <p className="en-disclaimer">Internal development system · Approval, payments and changes require authorized staff. Avoid real company records until production security review.</p>
        </>}
      </main>
    </div>
    {modal && <div className="en-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setModal(null);}}>
      <div className="en-modal" role="dialog" aria-modal="true" aria-labelledby="en-modal-title">
        <header><div><p className="en-eyebrow">{modal==="details"?"RECORD DETAILS":modal==="payment"?"FINANCE ENTRY":modal==="access"?"STAFF ACCESS":"CREATE RECORD"}</p>
          <h2 id="en-modal-title">{modal==="details" ? asText(active?.reference??active?.title??active?.username??"Record") :
            modal==="payment"?"Record payment":modal==="access"?"Update staff access":config.create}</h2></div>
          <button className="en-modal-close" disabled={busy} aria-label="Close" onClick={()=>setModal(null)}>×</button></header>
        {modal==="create"&&<form className="en-form" onSubmit={e=>void createRecord(e)}>
          {renderFields()}<footer><button type="button" className="en-secondary" onClick={()=>setModal(null)}>Cancel</button>
            <button className="en-primary" disabled={busy} type="submit">{busy?"Saving…":"Save record →"}</button></footer></form>}
        {modal==="payment"&&active&&<form className="en-form" onSubmit={e=>void addPayment(e)}>
          <p className="en-help">Invoice {asText(active.reference)} · {pretty(active.amount,"amount")} {asText(active.currency)}
            {" · "+pretty(active.paid_amount,"amount")+" already allocated"}</p>
          <FormField name="reference" label="Bank or transfer reference (unique)" required/>
          <FormField name="amount" label="Payment amount" type="number" required/>
          <FormField name="paidOn" label="Payment date" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/>
          <footer><button type="button" className="en-secondary" onClick={()=>setModal(null)}>Cancel</button>
            <button className="en-primary" disabled={busy}>Record payment →</button></footer></form>}
        {modal==="access"&&active&&<form className="en-form" onSubmit={e=>void changeAccess(e)}>
          <p className="en-help">Account: {asText(active.username)}. Do not disable your only administrator.</p>
          <FormField name="role" label="Authorized role"><select name="role" defaultValue={String(active.role)}>
            {allRoles.map(role=><option key={role} value={role}>{role}</option>)}</select></FormField>
          <label className="en-toggle"><input type="checkbox" name="enabled" defaultChecked={active.enabled===true}/> Account enabled</label>
          <footer><button type="button" className="en-secondary" onClick={()=>setModal(null)}>Cancel</button>
            <button className="en-primary" disabled={busy}>Save access →</button></footer></form>}
        {modal==="details"&&active&&<div className="en-details">
          <dl>{Object.entries(active).filter(([key])=>key!=="password_hash").map(([key,value])=><div key={key}>
            <dt>{key.replaceAll("_"," ")}</dt><dd>{pretty(value,key)}</dd></div>)}</dl>
          {detail.length>0&&<section className="en-timeline"><h3>{currentModule==="shipments"?"Shipment milestones":"Recorded payments"}</h3>
            {detail.map((item,i)=><div key={i}>{Object.entries(item).filter(([key])=>key!=="id").map(([key,value])=>
              <p key={key}><strong>{key.replaceAll("_"," ")}:</strong> {pretty(value,key)}</p>)}</div>)}</section>}
          {statuses(currentModule,active,user?.role??"",user?.username??"").length>0&&<div className="en-transitions"><h3>Available actions</h3>
            {statuses(currentModule,active,user?.role??"",user?.username??"").map(status=><button key={status} disabled={busy}
              onClick={()=>void changeStatus(active,status)}>{titles[status]??status} →</button>)}</div>}
          {currentModule==="invoices"&&active.status==="ISSUED"&&<button className="en-primary" onClick={()=>setModal("payment")}>Record payment →</button>}
          {currentModule==="staff"&&<button className="en-primary" onClick={()=>setModal("access")}>Edit staff access →</button>}
          <button className="en-secondary en-detail-close" onClick={()=>setModal(null)}>Close</button>
        </div>}
      </div>
    </div>}
  </div>;
}
