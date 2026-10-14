const modules=[
  {id:"command",label:"Executive cockpit",icon:"▦",category:"EXECUTIVE OVERSIGHT",
    title:"Global mission control",description:"A management-only cockpit designed to connect real operational KPIs, bottlenecks and prioritized follow-ups without fictional numbers.",
    flow:["Source data","Aggregate by workflow","Flag exceptions","Assign action"],headline:"From workflow data to decisions.",
    capabilities:["Operational status across customers, leads, open orders and active projects","Due-date exceptions for shipments, projects, invoices and tasks","Receivables and payables by original currency","Shipping and team workload watchlists"],
    policy:"Role-restricted executive data",safety:"Only authorized management roles can access actual business aggregates. Confidential commission data is deliberately excluded."},
  {id:"crm",label:"CRM & lead pipeline",icon:"✧",category:"CUSTOMER DEVELOPMENT",
    title:"Relationship intelligence",description:"Coordinate inbound opportunities from first contact through qualification and customer development with accountable owners.",
    flow:["Lead captured","Team follows up","Qualified opportunity","Customer or project"],headline:"A lead never gets lost in the inbox.",
    capabilities:["Customer and supplier contact directories","Lead source and responsible employee","Qualification status and next follow-up date","Linked projects and non-destructive activity evidence"],
    policy:"Scoped access and traceability",safety:"Sales staff can operate CRM only within authorized roles. Public website form ingestion remains gated on approved integrations."},
  {id:"entities",label:"Global entities",icon:"♧",category:"CORPORATE MASTER DATA",
    title:"The international directory",description:"Maintain legal entities, offices, branches and department contacts while preserving ownership relationships to customer and supplier records.",
    flow:["Register entity","Bind legal owner","Add branch details","Assign role contacts"],headline:"Every business identity stays connected.",
    capabilities:["Customer, supplier, partner and office entity types","Country, city, branch and HTTPS website details","Buying, finance, logistics and management contacts","Only one active primary contact per department"],
    policy:"Immutable identity linkage",safety:"Entity owner and entity type changes are controlled server-side; address and contact modifications are audited."},
  {id:"sourcing",label:"RFQ & sourcing",icon:"◇",category:"GLOBAL PROCUREMENT",
    title:"Source. Evaluate. Decide.",description:"Move buyer requirements from inquiry to supplier price discovery and internally approved customer quotations.",
    flow:["Receive inquiry","Collect offers","Compare terms","Approve quotation"],headline:"Structured supplier comparison.",
    capabilities:["RFQ creation and buyer reference","Supplier cost, MOQ and lead-time comparison","Guarded lifecycle transitions","Independent customer quotation approval"],
    policy:"Controlled commercial commitment",safety:"Frozen offers and four-eyes approvals reduce the risk of unauthorized, self-approved customer pricing."},
  {id:"sales",label:"Sales & purchasing",icon:"▣",category:"ORDER MANAGEMENT",
    title:"Commercial execution",description:"Keep approved customer quotes, sales commitments and supplier purchasing linked throughout fulfillment.",
    flow:["Approve quotation","Confirm sales order","Issue supplier PO","Execute fulfillment"],headline:"Linked end-to-end commerce.",
    capabilities:["Orders generated from approved customer quotes","Supplier offers matched to purchasing","Guarded order and purchase transitions","Currency-preserving contract amounts"],
    policy:"No orphan commercial records",safety:"Order transitions and purchase linkages are validated on the API. Contract amendment workflows remain in the roadmap."},
  {id:"logistics",label:"Freight & shipments",icon:"⇢",category:"LOGISTICS CONTROL",
    title:"Global movement visibility",description:"Connect commercial orders to booked shipments, destination consignees, milestones and delivery status.",
    flow:["Book shipment","Assign consignee","Track in transit","Confirm delivery"],headline:"Every shipment has a story.",
    capabilities:["Origin, destination, carrier and ETD/ETA details","Customer-scoped consignee directory","Pre-departure recipient validation","Append-only shipping milestones"],
    policy:"Correct consignee, correct customer",safety:"Shipments cannot be assigned to an inactive or unrelated customer's recipient. Secure shipping documents and carrier APIs are still planned."},
  {id:"finance",label:"Finance & expenses",icon:"▥",category:"FINANCIAL OPERATIONS",
    title:"Financial clarity",description:"Present recorded customer invoices, supplier payables and project cost evidence without blending currencies or pretending provisional amounts are audited profit.",
    flow:["Issue invoice","Record allocation","Approve costs","Review exposure"],headline:"Controls first. Numbers second.",
    capabilities:["Currency-aware receivable and payable tracking","Invoice payments with duplicate reference checks","Project expense approval and review","Evidence-gated provisional project contribution"],
    policy:"Separate currencies and duties",safety:"A production general ledger, reconciliation and tax framework are not implemented; do not treat current metrics as audited financial statements."},
  {id:"projects",label:"Projects & team",icon:"⬡",category:"EXECUTION MANAGEMENT",
    title:"Work with ownership",description:"Translate business commitments into named responsibility, deadlines, notes and visible progress.",
    flow:["Create project","Assign ownership","Track tasks","Review delivery"],headline:"Execution anchored to people.",
    capabilities:["Customer and order-linked projects","Internal notes and project statuses","Assigned tasks with priority and deadlines","Overdue work and project alerts"],
    policy:"Named staff and audit evidence",safety:"Only authorized roles can mutate governed records. In-app alerts do not send unsolicited outside messages."},
  {id:"security",label:"Identity & security",icon:"◈",category:"TRUST & ACCESS",
    title:"Security by architecture",description:"Layer authenticated access, bounded internal API relays and evidence of sensitive business changes.",
    flow:["Authenticate staff","Validate role","Verify transaction","Record activity"],headline:"Private operations require control.",
    capabilities:["Opaque revocable staff sessions","Role-aware API access and audit events","Optional authenticator MFA in the development baseline","Separate restricted commission vault"],
    policy:"Production review still required",safety:"Mandatory MFA, secure recovery, external audit retention, encryption policy and independent penetration testing are still necessary before live use."},
  {id:"roadmap",label:"Delivery roadmap",icon:"☷",category:"ENGINEERING WORKSTREAM",
    title:"Release with confidence",description:"Deliver scope as independently reviewed vertical slices rather than disguising a long feature backlog as a finished product.",
    flow:["Specify capability","Implement tests","Review CI","Release by gate"],headline:"Source of truth, not slideware.",
    capabilities:["50-item phased implementation backlog","Java/Testcontainers and Next.js build checks","Separate private full app and safe public design tour","Documented production blockers and rollout gates"],
    policy:"A preview is not production",safety:"The public showcase has no login, database, or company data. The full application requires managed infrastructure and security sign-off."}
];
const nav=document.querySelector("#nav"),byId=id=>document.getElementById(id);
let index=0;
modules.forEach((m,i)=>{
  const button=document.createElement("button");
  button.type="button";
  button.className="nav-item";
  button.dataset.module=m.id;
  button.setAttribute("aria-label","Preview "+m.label);
  const icon=document.createElement("span");icon.className="nav-icon";icon.textContent=m.icon;
  const title=document.createElement("span");title.textContent=m.label;
  button.append(icon,title);
  button.addEventListener("click",()=>show(i,true));
  nav.append(button);
});
function show(i,scroll=false){
  index=(i+modules.length)%modules.length;
  const m=modules[index];
  nav.querySelectorAll("button").forEach((button,j)=>{
    const active=index===j;
    button.classList.toggle("active",active);
    if(active)button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  });
  byId("breadcrumb").textContent=m.label;
  byId("module-symbol").textContent=m.icon;
  byId("module-category").textContent=m.category;
  byId("module-title").textContent=m.title;
  byId("module-description").textContent=m.description;
  byId("surface-headline").textContent=m.headline;
  byId("policy-title").textContent=m.policy;
  byId("policy-description").textContent=m.safety;
  byId("selection").textContent=(index+1)+" / "+modules.length+" · "+m.label;
  const steps=byId("workflow-steps");steps.replaceChildren();
  m.flow.forEach((stage,n)=>{
    const el=document.createElement("div");el.className="workflow-step";el.setAttribute("role","listitem");
    const num=document.createElement("span");num.className="step-num";num.textContent=String(n+1).padStart(2,"0");
    const label=document.createElement("strong");label.textContent=stage;
    const arrow=document.createElement("b");arrow.textContent=n===m.flow.length-1?"✓":"→";
    el.append(num,label,arrow);steps.append(el);
  });
  const list=byId("capability-list");list.replaceChildren();
  m.capabilities.forEach((feature)=>{
    const item=document.createElement("div");item.className="capability";
    const mark=document.createElement("span");mark.textContent="✓";
    const label=document.createElement("span");label.textContent=feature;
    item.append(mark,label);list.append(item);
  });
  history.replaceState(null,"","#"+m.id);
  if(scroll)byId("modules").scrollIntoView({behavior:"smooth",block:"start"});
}
byId("previous").addEventListener("click",()=>show(index-1));
byId("next").addEventListener("click",()=>show(index+1));
byId("explore").addEventListener("click",()=>byId("modules").scrollIntoView({behavior:"smooth"}));
const initial=modules.findIndex(m=>m.id===location.hash.slice(1));
show(initial>=0?initial:0);
