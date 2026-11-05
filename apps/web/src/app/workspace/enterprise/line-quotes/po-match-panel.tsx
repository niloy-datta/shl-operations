"use client";

import {useState} from "react";

type Match={
  purchaseOrderId:string;
  salesOrderId:string;
  matched:boolean;
  expectedLines:number;
  actualLines:number;
  currency:string;
  discrepancies:string[];
};

export function PoMatchPanel({poId}:{poId:string})
{
  const [result,setResult]=useState<Match|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function verify()
  {
    setBusy(true);setError("");
    try
    {
      const response=await fetch("/api/enterprise/commerce/line-orders/purchase-orders/"+
        poId+"/reconciliation",{cache:"no-store"});
      if(response.status===401)
      {
        window.location.assign("/login");
        throw new Error("Session expired");
      }
      if(!response.ok)
      {
        throw new Error("Verification unavailable ("+response.status+").");
      }
      setResult(await response.json() as Match);
    }
    catch(cause)
    {
      setError(cause instanceof Error?cause.message:"Verification unavailable.");
    }
    finally
    {
      setBusy(false);
    }
  }

  return <section className="po-match" aria-label="Purchase-order source reconciliation">
    <button type="button" disabled={busy} onClick={()=>void verify()}>
      {busy?"Checking…":"Verify PO line and currency match"}
    </button>
    {error&&<p role="alert">{error}</p>}
    {result&&<div>
      <strong>{result.matched?"Matched to source sales order":"Mismatch — issue blocked"}</strong>
      <small>{result.actualLines} PO line(s) / {result.expectedLines} expected · {result.currency}</small>
      {result.discrepancies.length>0&&<ul>{result.discrepancies.map(d=><li key={d}>{d}</li>)}</ul>}
    </div>}
  </section>;
}
