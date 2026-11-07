"use client";

import Link from "next/link";
import {usePathname,useSearchParams,useRouter} from "next/navigation";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {ArrowUpRight,Plus,Bell,Sun,Moon,Menu,LogOut,ChevronDown,ShieldCheck,
  LayoutDashboard,Users,Building2,Layers,Package,Ship,ChartNoAxesCombined,ListTodo,Lock,Settings} from "lucide-react";
import {useWorkspaceIdentity} from "./workspace-identity";
import {OperationsCommand} from "./operations-command";
import {visibleNavigation} from "@/lib/operations-navigation";
const icons={grid:LayoutDashboard,users:Users,building:Building2,layers:Layers,package:Package,ship:Ship,chart:ChartNoAxesCombined,check:ListTodo,lock:Lock};
export function NexusShell({children,initialTheme}:{children:ReactNode;initialTheme:"light"|"dark"}){
 const {staff,commissionAccess}=useWorkspaceIdentity();const path=usePathname();const query=useSearchParams();const router=useRouter();
 const [menu,setMenu]=useState(false),[dark,setDark]=useState(initialTheme==="dark"),[error,setError]=useState("");
 const menuButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!menu)return;
  const frame=requestAnimationFrame(()=>document.querySelector<HTMLElement>("#nexus-sidebar [aria-current=page]")?.focus());
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setMenu(false);menuButton.current?.focus();}};
  window.addEventListener("keydown",escape);return()=>{cancelAnimationFrame(frame);window.removeEventListener("keydown",escape);};
 },[menu]);
 const enrolled=path==="/workspace/account/enroll-mfa";
 if(enrolled)return <>{children}</>;
 const nav=visibleNavigation(staff?.role,commissionAccess);
 const current=path+(path==="/workspace"&&query.get("view")?"?view="+query.get("view"):"");
 const active=nav.flatMap(group=>group.items).find(item=>item.href===current);
 const heading=path==="/workspace"&&!query.get("view")?"My Day":active?.label||"Record workspace";
 const commercial=!!staff&&["ADMIN","MANAGEMENT","BD","SOURCING"].includes(staff.role);
 async function logout(){try{const r=await fetch("/api/auth/logout",{method:"POST"});if(!r.ok)throw new Error();router.replace("/login");router.refresh();}catch{setError("Sign out failed. Retry to revoke your session.");}}
 function theme(){const next=!dark;setDark(next);document.cookie="shl_nexus_theme="+(next?"dark":"light")+"; Path=/; Max-Age=31536000; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"");}
 return <div className="nx-shell" data-nexus-theme={dark?"dark":"light"}>
  <aside id="nexus-sidebar" className={"nx-sidebar"+(menu?" nx-open":"")} aria-label="Workspace sidebar">
   <Link href="/workspace" className="nx-brand" onClick={()=>setMenu(false)}><span className="nx-brand-mark" aria-hidden="true">SHL</span><span><strong>NEXUS</strong><small>OPERATIONS WORKSPACE</small></span></Link>
   <div className="nx-space"><span className="nx-space-icon">S</span><div><strong>Operations workspace</strong><small>Private · Internal access</small></div><ChevronDown size={14}/></div>
   <nav aria-label="Business modules">
    {nav.map(group=><div className="nx-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item=>{
     const Icon=icons[item.icon];return <Link key={item.href} href={item.href} onClick={()=>setMenu(false)} aria-current={current===item.href?"page":undefined}><Icon size={17}/><span>{item.href==="/workspace"?"My Day":item.href==="/workspace/command-center"?"Executive Overview":item.label}</span>{current===item.href&&<i/>}</Link>;
    })}</div>)}
   </nav>
   <div className="nx-sidebar-foot"><ShieldCheck size={15}/><span>Permission-controlled workspace</span></div>
  </aside>
  <div className="nx-main">
   <header className="nx-topbar">
    <button className="nx-icon nx-mobile-toggle" ref={menuButton} aria-label="Workspace modules" aria-controls="nexus-sidebar" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu size={20}/></button>
    <div className="nx-breadcrumb"><span>Workspace</span><span>/</span><strong>{heading}</strong></div>
    <OperationsCommand/>
    <div className="nx-top-actions">
     {commercial&&<details className="nx-create"><summary aria-label="Create a record"><Plus size={16}/><span>Create</span><ChevronDown size={12}/></summary><div>
      <Link onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");if(path==="/workspace"&&query.get("view")==="customers"){e.preventDefault();window.dispatchEvent(new CustomEvent("shl:quick-create",{detail:"customers"}));}}} href="/workspace?view=customers&create=1">Customer</Link><Link onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");if(path==="/workspace"&&query.get("view")==="suppliers"){e.preventDefault();window.dispatchEvent(new CustomEvent("shl:quick-create",{detail:"suppliers"}));}}} href="/workspace?view=suppliers&create=1">Supplier</Link><Link onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");if(path==="/workspace/rfqs"){e.preventDefault();window.dispatchEvent(new CustomEvent("shl:quick-create",{detail:"rfq"}));}}} href="/workspace/rfqs?create=1">RFQ / inquiry</Link>
     </div></details>}
     <Link className="nx-icon" href="/workspace/alerts" aria-label="Open operational alerts"><Bell size={18}/></Link>
     <button className="nx-icon" onClick={theme} aria-label={dark?"Switch to light theme":"Switch to dark theme"}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
     <details className="nx-profile"><summary aria-label="Account menu"><span>{staff?.username.slice(0,1).toUpperCase()||"S"}</span><div><strong>{staff?.username||"Loading account"}</strong><small>{staff?.role||"Checking access"}</small></div><ChevronDown size={12}/></summary><div className="nx-profile-menu"><p className="nx-profile-identity">{staff?.username}<small>{staff?.role}</small></p><Link href="/workspace/account"><Settings size={15}/> My security</Link><button onClick={()=>void logout()}><LogOut size={15}/> Sign out</button></div></details>
    </div>
   </header>
   {error&&<div className="nx-error" role="alert">{error}<button onClick={()=>void logout()}>Retry sign out</button></div>}
   <div className="nx-page">{children}</div>
   <footer className="nx-foot"><span><ShieldCheck size={13}/> SHL NEXUS · Private operations workspace</span><Link href="/workspace/account">Account security <ArrowUpRight size={12}/></Link></footer>
  </div>
 </div>;
}
