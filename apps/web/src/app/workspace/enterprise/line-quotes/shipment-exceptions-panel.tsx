"use client";

import {useEffect, useState, type FormEvent} from "react";

type Case = {
  id:string;
  type:string;
  status:string;
  description:string;
  review_due:string|null;
  opened_by:string;
  created_at:string;
  reviewed_by:string|null;
  resolution:string|null;
};
type Event = {id:string;event:string;notes:string;actor:string;created_at:string};

const TYPES = ["CUSTOMS_HOLD","TRANSSHIPMENT","DAMAGE","DISPUTE"];

export function ShipmentExceptionsPanel({shipmentId,shipmentStatus,role}:{
  shipmentId:string;
  shipmentStatus:string;
  role:string;
})
{
  const [cases,setCases] = useState<Case[]>([]);
  const [history,setHistory] = useState<Record<string,Event[]>>({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const canOpen = ["ADMIN","MANAGEMENT","LOGISTICS"].includes(role);
  const canResolve = ["ADMIN","MANAGEMENT"].includes(role);
  const path = "/api/enterprise/logistics/line-shipments/" + shipmentId + "/exceptions";

  useEffect(() =>
  {
    let active = true;
    fetch(path,{cache:"no-store"})
      .then(async response =>
      {
        if (!response.ok)
        {
          throw new Error("Shipment cases unavailable (" + response.status + ").");
        }
        return response.json() as Promise<Case[]>;
      })
      .then(rows => {if(active)setCases(rows);})
      .catch(cause => {if(active)setError(cause instanceof Error ? cause.message : "Unable to load cases.");});
    return () => {active = false;};
  },[path]);

  async function refresh()
  {
    const response = await fetch(path,{cache:"no-store"});
    if (!response.ok)
    {
      throw new Error("Unable to refresh shipment cases.");
    }
    setCases(await response.json() as Case[]);
  }

  async function open(event:FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      type:String(data.get("type") ?? ""),
      description:String(data.get("description") ?? "").trim(),
      reviewDue:String(data.get("reviewDue") ?? "") || null
    };
    try
    {
      const response = await fetch(path,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(payload)
      });
      if (!response.ok)
      {
        throw new Error("Could not open case (" + response.status + ").");
      }
      await refresh();
      form.reset();
      setNotice("Exception case opened and recorded.");
    }
    catch(cause)
    {
      setError(cause instanceof Error ? cause.message : "Could not open case.");
    }
    finally
    {
      setBusy(false);
    }
  }

  async function resolve(caseId:string, event:FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try
    {
      const response = await fetch(path + "/" + caseId + "/resolve",{
        method:"PATCH",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({resolution:String(data.get("resolution") ?? "").trim()})
      });
      if (!response.ok)
      {
        throw new Error("Independent review required; resolve failed (" + response.status + ").");
      }
      await refresh();
      setHistory(prev => ({...prev,[caseId]:[]}));
      setNotice("Case resolved; outcome saved to the event history.");
    }
    catch(cause)
    {
      setError(cause instanceof Error ? cause.message : "Could not resolve case.");
    }
    finally
    {
      setBusy(false);
    }
  }

  async function showHistory(caseId:string)
  {
    setError("");
    try
    {
      const response = await fetch(path + "/" + caseId + "/events",{cache:"no-store"});
      if (!response.ok)
      {
        throw new Error("Could not load audit events.");
      }
      setHistory(prev => ({...prev,[caseId]:[]}));
      const events = await response.json() as Event[];
      setHistory(prev => ({...prev,[caseId]:events}));
    }
    catch(cause)
    {
      setError(cause instanceof Error ? cause.message : "Could not load audit events.");
    }
  }

  return <section className="lx-exceptions" aria-label="Shipment exception cases">
    <h4>Shipment exceptions and disputes</h4>
    <p>Manual, auditable internal casework. No carrier claim or customs filing is submitted.</p>
    {error && <p role="alert" className="lq-error">{error}</p>}
    {notice && <p role="status" className="gx-notice">{notice}</p>}
    {cases.length === 0 && <p>No recorded exceptions for this shipment.</p>}
    {cases.map(item => <article className="lx-case" key={item.id}>
      <div><strong>{item.type.replaceAll("_"," ")} · {item.status}</strong>
        <small>Opened by {item.opened_by} · {new Date(item.created_at).toLocaleString("en-GB")}</small>
      </div>
      <p>{item.description}</p>
      {item.review_due && <p>Review due: {item.review_due}</p>}
      {item.resolution && <p><strong>Resolution:</strong> {item.resolution} ({item.reviewed_by})</p>}
      <button type="button" disabled={busy} onClick={() => void showHistory(item.id)}>View case history</button>
      {history[item.id] && history[item.id].length > 0 && <ol>
        {history[item.id].map(entry => <li key={entry.id}>
          <strong>{entry.event}</strong> · {entry.actor} · {new Date(entry.created_at).toLocaleString("en-GB")}
          <p>{entry.notes}</p>
        </li>)}
      </ol>}
      {item.status === "OPEN" && canResolve && <form onSubmit={event => void resolve(item.id,event)}>
        <label>Independent resolution review
          <textarea name="resolution" rows={2} maxLength={2000} required
            placeholder="Explain verified resolution and next actions."/>
        </label>
        <button type="submit" disabled={busy} className="lq-action">Resolve case</button>
      </form>}
    </article>)}
    {canOpen && shipmentStatus !== "CANCELLED" && <form className="lx-new-case" onSubmit={open}>
      <h5>Log a new exception</h5>
      <label>Exception type
        <select name="type" required>
          {TYPES.filter(type => shipmentStatus !== "DELIVERED" ||
            ["DAMAGE","DISPUTE"].includes(type)).map(type =>
            <option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}
        </select>
      </label>
      <label>Description and observed facts
        <textarea name="description" rows={3} maxLength={2000} required
          placeholder="State the issue and source of the information. Do not infer carrier confirmation."/>
      </label>
      <label>Review due date (optional)
        <input type="date" name="reviewDue"/>
      </label>
      <button className="lq-action" type="submit" disabled={busy}>
        {busy ? "Recording…" : "Open exception case"}
      </button>
    </form>}
  </section>;
}
