"use client";

import Link from "next/link";
import {useCallback, useEffect, useState, type FormEvent} from "react";

type Conversion = {
  leadId:string;
  customerId:string;
  rfqId:string;
  projectId:string;
  reviewedBy:string;
  createdAt:string;
};
type Customer = {id:string;name:string};
type Staff = {id:string;username:string;role:string};
type CustomerPage = {content:Customer[]};

export function LeadConversionPanel({leadId,companyName,customerId,ownerId}:{
  leadId:string;
  companyName:string;
  customerId:string|null;
  ownerId:string|null;
})
{
  const [conversion,setConversion] = useState<Conversion|null>(null);
  const [loaded,setLoaded] = useState(false);
  const [customers,setCustomers] = useState<Customer[]>([]);
  const [staff,setStaff] = useState<Staff[]>([]);
  const [search,setSearch] = useState(companyName);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const loadCustomers = useCallback(async (q:string) =>
  {
    const response = await fetch("/api/data/customers?" +
      new URLSearchParams({q,size:"100"}),{cache:"no-store"});
    if (!response.ok)
    {
      throw new Error("Customer search failed (" + response.status + ").");
    }
    const data = await response.json() as CustomerPage;
    setCustomers(data.content);
  },[]);

  useEffect(() =>
  {
    let active = true;
    (async () =>
    {
      try
      {
        const path = "/api/growth/leads/" + leadId + "/conversion";
        const existing = await fetch(path,{cache:"no-store"});
        if (existing.ok)
        {
          const data = await existing.json() as Conversion;
          if (active)
          {
            setConversion(data);
          }
        }
        else if (existing.status !== 404)
        {
          throw new Error("Conversion check failed (" + existing.status + ").");
        }
        const [people] = await Promise.all([
          fetch("/api/enterprise/staff/options",{cache:"no-store"}),
          loadCustomers(companyName)
        ]);
        if (!people.ok)
        {
          throw new Error("Active owner list unavailable.");
        }
        if (active)
        {
          setStaff(await people.json() as Staff[]);
        }
      }
      catch(cause)
      {
        if (active)
        {
          setError(cause instanceof Error ? cause.message : "Unable to load conversion form.");
        }
      }
      finally
      {
        if (active)
        {
          setLoaded(true);
        }
      }
    })();
    return () => {active = false;};
  },[leadId,companyName,loadCustomers]);

  async function submit(event:FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const value = (field:string) => String(values.get(field) ?? "").trim();
    const payload = {
      customerId:customerId || value("customerId"),
      ownerId:value("ownerId"),
      quantity:value("quantity"),
      unit:value("unit"),
      currency:value("currency"),
      rfqDeadline:value("rfqDeadline") || null,
      projectTitle:value("projectTitle"),
      projectDescription:value("projectDescription") || null,
      projectDueDate:value("projectDueDate") || null,
      reviewReason:value("reviewReason")
    };
    setBusy(true);
    setError("");
    setNotice("");
    try
    {
      const response = await fetch("/api/growth/leads/" + leadId + "/conversion", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(payload)
      });
      if (!response.ok)
      {
        throw new Error("Conversion declined (" + response.status +
          "). Check review ownership, linked customer and required details.");
      }
      setConversion(await response.json() as Conversion);
      setNotice("Lead linked to an RFQ and project.");
    }
    catch(cause)
    {
      setError(cause instanceof Error ? cause.message : "Unable to convert lead.");
    }
    finally
    {
      setBusy(false);
    }
  }

  return <section className="gx-conversion" aria-label="Reviewed lead conversion">
    <h3>Reviewed lead conversion</h3>
    <p className="en-help">A different authorized reviewer must approve this won lead. Conversion links an existing customer to a new sourcing RFQ and a planned project; it does not quote, order, invoice or message anyone.</p>
    {error && <p className="en-alert" role="alert">{error}</p>}
    {notice && <p className="gx-notice" role="status">{notice}</p>}
    {!loaded && <p className="en-help">Loading conversion status…</p>}
    {conversion ? <div className="gx-conversion-result">
      <strong>Converted and linked</strong>
      <small>Reviewed by {conversion.reviewedBy}</small>
      <p>Customer: {conversion.customerId}</p>
      <p>RFQ: {conversion.rfqId}</p>
      <p>Project: {conversion.projectId}</p>
      <div><Link href="/workspace/rfqs">Open RFQ desk</Link>
        <Link href="/workspace/growth/projects">Open projects</Link></div>
    </div> : loaded && !error && <form className="gx-conversion-form" onSubmit={submit}>
      {customerId ? <p className="en-help">Linked customer: {customerId}</p> : <>
        <label className="en-field"><span>Search existing approved customer</span>
          <input value={search} onChange={e => setSearch(e.target.value)} maxLength={120}/>
        </label>
        <button type="button" className="gx-conversion-search" onClick={() =>
        {
          void loadCustomers(search).catch(cause =>
            setError(cause instanceof Error ? cause.message : "Customer search failed."));
        }}>Search customers</button>
        <label className="en-field"><span>Select customer</span>
          <select name="customerId" required defaultValue="">
            <option value="">Choose an existing customer</option>
            {customers.map(customer =>
              <option value={customer.id} key={customer.id}>{customer.name}</option>)}
          </select>
        </label>
      </>}
      <label className="en-field"><span>Responsible project owner</span>
        <select name="ownerId" required defaultValue={ownerId || ""}>
          <option value="">Select active staff</option>
          {staff.map(person => <option key={person.id} value={person.id}>
            {person.username} · {person.role}
          </option>)}
        </select>
      </label>
      <div className="gx-two">
        <label className="en-field"><span>RFQ quantity</span>
          <input name="quantity" type="number" min="0.001" step="0.001" required/>
        </label>
        <label className="en-field"><span>Unit</span>
          <input name="unit" maxLength={32} required placeholder="PCS, KG, MT"/>
        </label>
      </div>
      <div className="gx-two">
        <label className="en-field"><span>Currency</span>
          <select name="currency" defaultValue="USD">
            {["USD","EUR","GBP","CNY","BDT"].map(x => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="en-field"><span>RFQ deadline</span>
          <input type="date" name="rfqDeadline"/>
        </label>
      </div>
      <label className="en-field"><span>Project title</span>
        <input name="projectTitle" maxLength={180} defaultValue={companyName + " opportunity"} required/>
      </label>
      <label className="en-field"><span>Project details (optional)</span>
        <textarea name="projectDescription" maxLength={2000} rows={2}/>
      </label>
      <label className="en-field"><span>Project due date (optional)</span>
        <input name="projectDueDate" type="date"/>
      </label>
      <label className="en-field"><span>Independent review decision/reason</span>
        <textarea name="reviewReason" maxLength={300} rows={2} required
          placeholder="State what you verified before converting this won lead."/>
      </label>
      <button className="en-primary" type="submit" disabled={busy}>
        {busy ? "Converting…" : "Approve and link records"}
      </button>
    </form>}
  </section>;
}
