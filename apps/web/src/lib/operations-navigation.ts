/**
 * Single source of truth for the Operations OS information architecture.
 *
 * Menu filtering is presentation only. API authorization remains authoritative.
 * Add a module here once; the home sidebar, enterprise sidebar and command
 * palette all use these same records. No hard-coded financial access override.
 */
export type StaffRole = "ADMIN" | "MANAGEMENT" | "BD" | "SOURCING" | "LOGISTICS" | "FINANCE";
export type NavigationIcon =
  "grid" | "users" | "building" | "layers" | "package" |
  "ship" | "chart" | "check" | "lock";
export type NavModule = {
  label: string;
  href: string;
  icon: NavigationIcon;
  symbol: string;
  description: string;
  keywords?: string;
  roles?: readonly StaffRole[];
};
export type NavGroup = { label: string; items: readonly NavModule[] };

const exec: StaffRole[] = ["ADMIN","MANAGEMENT"];
const sales: StaffRole[] = ["ADMIN","MANAGEMENT","BD"];
const sourcing: StaffRole[] = ["ADMIN","MANAGEMENT","BD","SOURCING"];
const supply: StaffRole[] = ["ADMIN","MANAGEMENT","SOURCING"];
const shipping: StaffRole[] = ["ADMIN","MANAGEMENT","LOGISTICS","SOURCING"];
const finance: StaffRole[] = ["ADMIN","MANAGEMENT","FINANCE"];

export const OPERATIONS_NAVIGATION: readonly NavGroup[] = [
  {label:"Workspace",items:[
    {label:"Overview",href:"/workspace",icon:"grid",symbol:"▦",
      description:"Your main operations dashboard",keywords:"home dashboard"},
    {label:"Customers",href:"/workspace?view=customers",icon:"users",symbol:"♙",
      description:"Customer relationships and contacts",keywords:"buyers directory"},
    {label:"Suppliers",href:"/workspace?view=suppliers",icon:"building",symbol:"◇",
      description:"Vendor relationships and contacts",keywords:"vendors directory"},
    {label:"Executive cockpit",href:"/workspace/command-center",icon:"chart",symbol:"◈",
      description:"Management exceptions and live KPIs",roles:exec,keywords:"ceo reports management"},
    {label:"Due dates & alerts",href:"/workspace/alerts",icon:"check",symbol:"◉",
      description:"Overdue work and reminders",keywords:"inbox notifications tasks"}
  ]},
  {label:"Growth & sourcing",items:[
    {label:"Lead pipeline",href:"/workspace/growth/leads",icon:"users",symbol:"✧",
      description:"Inbound inquiries and assigned follow-ups",roles:sales,keywords:"crm opportunity"},
    {label:"Projects & jobs",href:"/workspace/growth/projects",icon:"grid",symbol:"▱",
      description:"Project owners, stages and deadlines",keywords:"delivery jobs"},
    {label:"RFQ & sourcing",href:"/workspace/rfqs",icon:"layers",symbol:"▤",
      description:"RFQs, item prices and approved line quotes",roles:sourcing,
      keywords:"quotation pricing sourcing line quote"},
    {label:"Customer quotations",href:"/workspace/enterprise/quotes",icon:"layers",symbol:"◈",
      description:"Legacy quotation review and approvals",roles:sourcing}
  ]},
  {label:"Trade & logistics",items:[
    {label:"Sales orders",href:"/workspace/enterprise/orders",icon:"grid",symbol:"▣",
      description:"Customer order lifecycle (legacy view)",roles:sourcing},
    {label:"Purchase orders",href:"/workspace/enterprise/purchase-orders",icon:"package",symbol:"⬡",
      description:"Supplier purchase orders (legacy view)",roles:supply,keywords:"po procurement"},
    {label:"Shipments",href:"/workspace/enterprise/shipments",icon:"ship",symbol:"⇢",
      description:"Shipment bookings and milestone history",roles:shipping,keywords:"eta etd freight"},
    {label:"Consignees",href:"/workspace/consignees",icon:"users",symbol:"◎",
      description:"Shipping recipient directory",roles:shipping}
  ]},
  {label:"Finance & control",items:[
    {label:"Finance & invoices",href:"/workspace/enterprise/invoices",icon:"chart",symbol:"▥",
      description:"Legacy invoices and payment records",roles:finance},
    {label:"Line billing review",href:"/workspace/finance/line-billing",icon:"chart",symbol:"▤",
      description:"Unposted line-order billing candidates",roles:finance,keywords:"billing review"},
    {label:"Expenses",href:"/workspace/costs/expenses",icon:"chart",symbol:"◎",
      description:"Controlled expense records",roles:finance},
    {label:"Project contribution",href:"/workspace/costs/profitability",icon:"chart",symbol:"◴",
      description:"Provisional source-backed contribution",roles:finance,keywords:"profitability margin"}
  ]},
  {label:"Administration",items:[
    {label:"Team tasks",href:"/workspace/enterprise/tasks",icon:"check",symbol:"☷",
      description:"Owners, due dates and assignments",keywords:"staff todo follow up"},
    {label:"Global entities",href:"/workspace/entities",icon:"building",symbol:"♧",
      description:"Company structure, branches and contacts",roles:sourcing},
    {label:"Dedup review",href:"/workspace/dedup",icon:"layers",symbol:"◎",
      description:"Read-only duplicate-record review",roles:exec},
    {label:"Staff & access",href:"/workspace/enterprise/staff",icon:"users",symbol:"♧",
      description:"Administer named staff accounts",roles:["ADMIN"],keywords:"roles security"},
    {label:"Audit trail",href:"/workspace/enterprise/audit",icon:"lock",symbol:"⊞",
      description:"Review operational change evidence",roles:exec},
    {label:"My security",href:"/workspace/account",icon:"lock",symbol:"◌",
      description:"MFA, password and active sessions",keywords:"account settings"}
  ]}
];

export const COMMISSION_NAV: NavModule = {
  label:"Commission vault",href:"/workspace/costs/commissions",icon:"lock",
  symbol:"◆",description:"Confidential restricted commission records",keywords:"commission"
};

export function visibleNavigation(role: string | null | undefined, canViewCommissions=false): NavGroup[] {
  const groups=OPERATIONS_NAVIGATION.map(group=>({
    label:group.label,
    items:group.items.filter(item=>!item.roles || (!!role&&item.roles.some(r=>r===role)))
  }));
  if(canViewCommissions) {
    const target=groups.find(group=>group.label==="Finance & control");
    target?.items.push(COMMISSION_NAV);
  }
  return groups.filter(group=>group.items.length>0);
}

export function navigationMatches(item: NavModule, query: string): boolean {
  const tokens=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const haystack=[item.label,item.description,item.keywords??"",item.href].join(" ").toLocaleLowerCase();
  return tokens.every(token=>haystack.includes(token));
}
