"use client";

import {useEffect, useState, type FormEvent} from "react";

type ConsentEvent = {
  id:string;
  channel:string;
  purpose:string;
  decision:string;
  evidence:string;
  actor:string;
  created_at:string;
};
type Snapshot = {
  current:ConsentEvent[];
  history:ConsentEvent[];
};

const channels = ["EMAIL", "PHONE", "WECHAT"];
const purposes = ["FOLLOW_UP", "MARKETING"];
const formatDate = (value:string) => new Date(value).toLocaleString("en-GB");

export function LeadConsentPanel({leadId}:{leadId:string})
{
  const [snapshot, setSnapshot] = useState<Snapshot|null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() =>
  {
    const controller = new AbortController();
    fetch("/api/growth/leads/" + leadId + "/consents", {
      cache:"no-store",
      signal:controller.signal
    })
      .then(async response =>
      {
        if (!response.ok)
        {
          throw new Error("Unable to read contact preferences (" + response.status + ").");
        }
        return response.json() as Promise<Snapshot>;
      })
      .then(data => setSnapshot(data))
      .catch(cause =>
      {
        if (!controller.signal.aborted)
        {
          setError(cause instanceof Error ? cause.message : "Unable to load preferences.");
        }
      });
    return () => controller.abort();
  }, [leadId]);

  async function submit(event:FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      channel:String(values.get("channel") ?? ""),
      purpose:String(values.get("purpose") ?? ""),
      decision:String(values.get("decision") ?? ""),
      evidence:String(values.get("evidence") ?? "").trim()
    };
    try
    {
      const path = "/api/growth/leads/" + leadId + "/consents";
      const created = await fetch(path, {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(payload)
      });
      if (!created.ok)
      {
        throw new Error("Preference could not be saved (" + created.status + ").");
      }
      const refreshed = await fetch(path, {cache:"no-store"});
      if (!refreshed.ok)
      {
        throw new Error("Preference saved, but refresh failed. Reopen this lead.");
      }
      setSnapshot(await refreshed.json() as Snapshot);
      setNotice("Preference event recorded in the audit history.");
      form.reset();
    }
    catch (cause)
    {
      setError(cause instanceof Error ? cause.message : "Unable to save preference.");
    }
    finally
    {
      setBusy(false);
    }
  }

  return <section className="gx-consent" aria-label="Contact preferences">
    <h3>Contact preferences and consent history</h3>
    <p className="en-help">
      Unknown means no evidence is recorded. A staff-entered opt-in is not legal verification or permission to send automatically.
      Revocations remain visible. No external message is sent.
    </p>
    {error && <p className="en-alert" role="alert">{error}</p>}
    {notice && <p className="gx-notice" role="status">{notice}</p>}
    {!snapshot && !error && <p className="en-help">Loading preferences…</p>}
    {snapshot && <>
      <div className="gx-consent-status">
        {channels.flatMap(channel => purposes.map(purpose =>
        {
          const latest = snapshot.current.find(row => row.channel === channel && row.purpose === purpose);
          return <div key={channel + purpose}>
            <span>{channel.replaceAll("_", " ")} · {purpose.replaceAll("_", " ")}</span>
            <strong>{latest?.decision ?? "UNKNOWN"}</strong>
          </div>;
        }))}
      </div>
      <form onSubmit={submit} className="gx-consent-form">
        <label className="en-field"><span>Contact channel</span>
          <select name="channel" required>
            {channels.map(channel => <option key={channel} value={channel}>{channel}</option>)}
          </select>
        </label>
        <label className="en-field"><span>Purpose</span>
          <select name="purpose" required>
            {purposes.map(purpose => <option key={purpose} value={purpose}>{purpose.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="en-field"><span>Decision</span>
          <select name="decision" required>
            <option value="REVOKED">Revoked / opted out</option>
            <option value="GRANTED">Granted / opted in</option>
          </select>
        </label>
        <label className="en-field"><span>Evidence or reason (required)</span>
          <textarea name="evidence" rows={2} maxLength={500} required
            placeholder="Record when/how the person expressed their preference. Do not paste private messages."/>
        </label>
        <button type="submit" className="en-primary" disabled={busy}>
          {busy ? "Recording…" : "Record contact preference"}
        </button>
      </form>
      <h4>Recent changes</h4>
      {snapshot.history.length === 0 && <p className="en-help">No decisions recorded yet.</p>}
      {snapshot.history.map(row => <article key={row.id} className="gx-consent-event">
        <strong>{row.channel} · {row.purpose.replaceAll("_", " ")} · {row.decision}</strong>
        <small>{row.actor} · {formatDate(row.created_at)}</small>
        <p>{row.evidence}</p>
      </article>)}
      {snapshot.history.length === 100 && <p className="en-help">Displaying the latest 100 events only.</p>}
    </>}
  </section>;
}
