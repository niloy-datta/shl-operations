"use client";
import {useMemo,useState} from "react";
import {WorkspaceDialog} from "./workspace-dialog";
import {parseContactCsv,contactIssues,importFields,type ImportRecord} from "@/lib/contact-import";
import {expireWorkspaceSession} from "@/lib/session-client";
type Row={record:ImportRecord;message:string;state:"invalid"|"unchecked"|"ready"|"duplicate"|"saved"|"failed"};
export function ContactImport({kind,onClose,onSaved}:{kind:"customers"|"suppliers";onClose:()=>void;onSaved:()=>void}){
 const [csv,setCsv]=useState<string[][]>([]),[mapping,setMapping]=useState<Record<string,string>>({}),[checked,setChecked]=useState<Row[]|null>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[approved,setApproved]=useState(false);
 const preview=useMemo(()=>{
  const seen=new Set<string>();return csv.slice(1).map(values=>{
   const record=Object.fromEntries(importFields.map(field=>[field,(values[Number(mapping[field])]||"").trim()])) as ImportRecord;
   const issues=contactIssues(record);const key=record.name.toLocaleLowerCase();
   if(seen.has(key))issues.push("Duplicate name within CSV");seen.add(key);
   return {record,message:issues.join("; ")||"Not checked against directory",state:issues.length?"invalid":"unchecked"} as Row;
  });
 },[csv,mapping]);
 const rows=checked||preview;
 async function file(file:File|undefined){setError("");setChecked(null);setApproved(false);if(!file)return;
  try{if(!file.name.toLowerCase().endsWith(".csv"))throw new Error("Use a UTF-8 CSV file. Excel workbooks are not supported yet.");if(file.size>1_048_576)throw new Error("CSV must be at most 1 MB.");const data=parseContactCsv(await file.text());setCsv(data);setMapping(Object.fromEntries(importFields.map(field=>[field,String(data[0].findIndex(v=>v.trim().toLowerCase()===field))])));}catch(e){setCsv([]);setError(e instanceof Error?e.message:"Cannot read CSV");}
 }
 async function validate(){setBusy(true);setError("");setApproved(false);const next=preview.map(row=>({...row}));
  try{for(const row of next){if(row.state==="invalid")continue;
   const response=await fetch("/api/data/"+kind+"?"+new URLSearchParams({q:row.record.name,size:"100"}),{cache:"no-store"});
   if(response.status===401)expireWorkspaceSession();if(!response.ok)throw new Error("Directory validation unavailable. No records have been saved.");
   const data=await response.json() as {totalElements:number;content:{name:string;email:string|null}[]};
   const duplicate=data.content.some(item=>item.name.trim().toLocaleLowerCase()===row.record.name.toLocaleLowerCase());
   row.state=duplicate||data.totalElements>100?"duplicate":"ready";row.message=duplicate?"Existing name — review manually":data.totalElements>100?"Too many matches — review manually":"Validated for review";
  }setChecked(next);}catch(e){setChecked(null);setError(e instanceof Error?e.message:"Validation failed");}finally{setBusy(false);}
 }
 async function save(){if(!checked||!approved)return;setBusy(true);setError("");const next=checked.map(row=>({...row}));
  try{for(const row of next){if(row.state!=="ready")continue;
   // Recheck immediately before each write. Existing single-record API has no bulk transaction/unique-name guarantee.
   const check=await fetch("/api/data/"+kind+"?"+new URLSearchParams({q:row.record.name,size:"100"}),{cache:"no-store"});
   if(!check.ok)throw new Error("Final duplicate check unavailable. Remaining records were not sent.");
   const found=await check.json() as {totalElements:number;content:{name:string}[]};
   if(found.totalElements>100||found.content.some(x=>x.name.trim().toLowerCase()===row.record.name.toLowerCase())){row.state="duplicate";row.message="Name now exists — skipped";continue;}
   try{const response=await fetch("/api/data/"+kind,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(row.record)});
    if(response.status===401)expireWorkspaceSession();
    if(!response.ok){row.state="failed";row.message="Rejected: HTTP "+response.status;throw new Error("Import stopped after a rejected record. Review results before continuing.");}
    row.state="saved";row.message="Saved through directory API";
   }catch(e){if(row.state!=="failed"){row.state="failed";row.message="Save outcome unknown — refresh directory before retry";}throw e;}
  }}catch(e){setError(e instanceof Error?e.message:"Import stopped");}finally{setChecked(next);setBusy(false);setApproved(false);onSaved();}
 }
 return <div className="modal-backdrop"><WorkspaceDialog className="nx-import-dialog" aria-label="Review CSV import" onClose={onClose} busy={busy}>
  <header><div><p className="nx-eyebrow">CONTROLLED DIRECTORY IMPORT</p><h2>Review {kind} before saving</h2></div><button disabled={busy} onClick={onClose} aria-label="Close import">×</button></header>
  <p>UTF-8 CSV only · Maximum 100 rows / 1 MB · Nothing is saved until you review and confirm. Duplicate detection uses normalized company names; contact-level matching and Excel are pending.</p>
  <label>Choose CSV file<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void file(e.target.files?.[0])}/></label>
  {error&&<p role="alert">{error}</p>}{csv.length>0&&<>
   <div className="nx-import-mapping">{importFields.map(field=><label key={field}>{field}<select aria-label={"Map "+field} disabled={busy||!!checked} value={mapping[field]??"-1"} onChange={e=>{setMapping({...mapping,[field]:e.target.value});setChecked(null);setApproved(false);}}><option value="-1">Not mapped</option>{csv[0].map((header,i)=><option key={i} value={i}>{header||"Column "+(i+1)}</option>)}</select></label>)}</div>
   <div className="nx-import-table"><table><thead><tr><th>Name</th><th>Email</th><th>Country</th><th>Validation / result</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td>{row.record.name||"Missing name"}</td><td>{row.record.email||"—"}</td><td>{row.record.country||"—"}</td><td>{row.message}</td></tr>)}</tbody></table></div>
   <p role="status">{rows.filter(row=>row.state==="ready").length} ready · {rows.filter(row=>["invalid","duplicate"].includes(row.state)).length} excluded · {rows.filter(row=>row.state==="saved").length} saved</p>
   {!checked?<button className="nx-button" disabled={busy} onClick={()=>void validate()}>Validate against existing directory</button>:<>
    <label className="nx-import-confirm"><input type="checkbox" checked={approved} disabled={busy} onChange={e=>setApproved(e.target.checked)}/> I reviewed the mapped rows and approve saving only validated records.</label>
    <p>Records are saved individually. A later failure does not roll back earlier saves. Concurrent imports can still create duplicates; review results before retrying.</p>
    <button className="nx-button" disabled={busy||!approved||!rows.some(row=>row.state==="ready")} onClick={()=>void save()}>{busy?"Saving reviewed records…":"Save reviewed records"}</button>
   </>}
  </>}
 </WorkspaceDialog></div>;
}
