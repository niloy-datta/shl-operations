"use client";
import Link from "next/link";
import {Building2,Mail,Phone,Globe,ArrowUpRight,X} from "lucide-react";
import {WorkspaceDialog} from "./workspace-dialog";
import {useWorkspaceIdentity} from "./workspace-identity";
type Contact={id:string;name:string;country:string|null;email:string|null;phone:string|null;createdAt:string};
export function NexusProfile({record,kind,onClose}:{record:Contact;kind:"customers"|"suppliers";onClose:()=>void}){
 const {staff}=useWorkspaceIdentity();const commercial=!!staff&&["ADMIN","MANAGEMENT","BD","SOURCING"].includes(staff.role);
 return <div className="nx-profile-backdrop"><WorkspaceDialog className="nx-profile-drawer" aria-label={record.name+" profile"} onClose={onClose}>
  <header><p className="nx-eyebrow">{kind==="customers"?"CUSTOMER RELATIONSHIP":"SUPPLIER INTELLIGENCE"}</p><button className="nx-icon" aria-label="Close profile" onClick={onClose}><X size={20}/></button></header>
  <span className="nx-profile-emblem"><Building2 size={28}/></span><h2>{record.name}</h2><p className="nx-muted">{record.country||"Country not recorded"} · Saved business record</p>
  <section><h3>Contact information</h3><dl><dt><Globe size={15}/> Country</dt><dd>{record.country||"Not recorded"}</dd><dt><Mail size={15}/> Email</dt><dd>{record.email?<a href={"mailto:"+record.email}>{record.email}</a>:"Not recorded"}</dd><dt><Phone size={15}/> Phone</dt><dd>{record.phone||"Not recorded"}</dd></dl></section>
  <section><h3>Connected workspaces</h3>{commercial&&<Link href={kind==="suppliers"?"/workspace/suppliers/compliance?"+new URLSearchParams({supplierId:record.id,supplierName:record.name}):"/workspace/rfqs?q="+encodeURIComponent(record.name)} className="nx-profile-link">{kind==="suppliers"?"Review certifications & evidence references":"Find customer RFQs & quotations"}<ArrowUpRight size={16}/></Link>}
   <p className="nx-muted">{kind==="suppliers"?"Evidence references require independent staff review. Secure document upload and vendor scoring are pending.":"Lead communication history and follow-ups are maintained in the lead pipeline."}</p>{commercial&&kind==="customers"&&<Link className="nx-profile-link" href="/workspace/growth/leads">Open customer lead pipeline <ArrowUpRight size={16}/></Link>}</section>
  <section><h3>Record provenance</h3><p className="nx-muted">Created {new Date(record.createdAt).toLocaleDateString("en-GB")} · ID {record.id}</p></section>
 </WorkspaceDialog></div>;
}
