"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

type Kind="customers"|"suppliers"|"consignees";
type Candidate={match_type:string;match_key:string;candidate_count:number;member_ids:string};
type Page={content:Candidate[];totalElements:number;totalPages:number};
const destinations:Record<Kind,string>={
  customers:"/workspace?view=customers",
  suppliers:"/workspace?view=suppliers",
  consignees:"/workspace/consignees"
};
const labels:Record<Kind,string>={customers:"Customers",suppliers:"Suppliers",consignees:"Consignees"};

export function DedupReviewDesk(){
  const [kind,setKind]=useState<Kind>("customers");
  const [page,setPage]=useState(0);
  const [results,setResults]=useState<Page>({content:[],totalElements:0,totalPages:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);

  useEffect(()=>{
    const ctrl=new AbortController();
    const params=new URLSearchParams({entity:kind,page:String(page),size:"15"});
    const load=async()=>{
      setLoading(true);setError("");
      try{
        const response=await fetch("/api/enterprise/dedup/candidates?"+params,{
          signal:ctrl.signal,cache:"no-store"
        });
        if(response.status===401){window.location.assign("/login");return;}
        if(response.status===403)throw new Error("This review is restricted to management.");
        if(!response.ok)throw new Error("Could not retrieve candidate groups.");
        setResults(await response.json() as Page);
      }catch(e){
        if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:"Could not load results.");
      }finally{if(!ctrl.signal.aborted)setLoading(false);}
    };
    void load();
    return()=>ctrl.abort();
  },[kind,page,revision]);

  return <main className="du-page">
    <header className="du-top">
      <div><Link href="/workspace" className="du-back">← Operations dashboard</Link>
        <p className="du-eyebrow">DATA GOVERNANCE / MANAGEMENT ONLY</p>
        <h1>Duplicate review<span>.</span></h1>
        <p>Find exact-key candidates without changing records or risking linked shipments and payments.</p></div>
      <div className="du-safety"><strong>Review only</strong><span>No automatic merging or deletion</span></div>
    </header>
    <section className="du-panel">
      <div className="du-toolbar">
        <div className="du-tabs" role="group" aria-label="Directory to review">
          {(["customers","suppliers","consignees"] as Kind[]).map(item=>
            <button key={item} type="button" aria-pressed={item===kind}
              onClick={()=>{setKind(item);setPage(0);}}>{labels[item]}</button>)}
        </div>
        <button type="button" className="du-refresh" onClick={()=>setRevision(x=>x+1)}>
          Refresh ↻
        </button>
      </div>
      <div className="du-intro">
        <div><h2>Possible duplicate groups</h2>
          <p>Matches are based on normalized exact email or name + country.
             Consignees are never compared across different customers.</p>
        </div>
        <strong>{results.totalElements} groups</strong>
      </div>
      {error&&<div className="du-error" role="alert">{error}</div>}
      {loading&&<p className="du-empty" role="status">Checking for exact duplicate keys…</p>}
      {!loading&&!error&&results.content.length===0&&<p className="du-empty">
        No exact duplicate candidate groups found in this directory.</p>}
      {!loading&&!error&&results.content.map(group=>
        <article className="du-card" key={group.match_type+"|"+group.match_key}>
          <div className="du-card-head">
            <span className="du-category">{group.match_type.replaceAll("_"," + ")}</span>
            <span>{group.candidate_count} records</span>
          </div>
          <h3>{group.match_key}</h3>
          <details><summary>Show record identifiers</summary>
            <div className="du-members">
              {group.member_ids.split(",").map(member=>
                <code key={member}>{member}</code>)}
            </div>
          </details>
        </article>)}
      <footer className="du-footer">
        <span>Page {page+1} of {Math.max(1,results.totalPages)} · No changes applied</span>
        <div><button type="button" disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>Previous</button>
        <button type="button" disabled={page+1>=results.totalPages||loading}
          onClick={()=>setPage(p=>p+1)}>Next</button></div>
      </footer>
    </section>
    <section className="du-guidance">
      <div><h2>Before making changes</h2><p>
        These are review leads, not confirmed duplicate legal entities.
        Compare registration details, legal identity, customer ownership and
        every linked RFQ, order, invoice, shipment and audit record manually.
        An approved foreign-key-safe merge process has not been built.
      </p></div>
      <Link href={destinations[kind]}>Inspect {labels[kind].toLowerCase()} →</Link>
    </section>
  </main>;
}
