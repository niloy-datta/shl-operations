"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Status = { enabled: boolean; required: boolean; verified: boolean };
type Enrollment = { factorId: string; secret: string; otpAuthUrl: string };

async function send<T>(action: string, body: Record<string, string>): Promise<T> {
  const response = await fetch("/api/auth/mfa/" + action, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Authenticator request failed. Please retry.");
  return data as T;
}

export function MfaSettings({ continueHref = "/workspace" }: { continueHref?: "/workspace" | "/reset-password" }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<Enrollment | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/auth/mfa/status", { cache: "no-store", signal });
      if (response.status === 401) { router.replace("/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check MFA settings.");
      if (!signal?.aborted) { setStatus(data as Status); setError(""); }
    } catch (caught) {
      if (!signal?.aborted) setError(caught instanceof Error ? caught.message : "MFA settings are unavailable.");
    }
  }, [router]);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const password = String(new FormData(event.currentTarget).get("password") || "");
    setBusy(true); setError("");
    try { setPending(await send<Enrollment>("enroll", { password })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to begin enrollment."); }
    finally { setBusy(false); }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const code = String(new FormData(event.currentTarget).get("code") || "");
    setBusy(true); setError("");
    try {
      await send(pending ? "confirm" : "challenge", { code, ...(pending ? { factorId: pending.factorId } : {}) });
      setPending(null); setCompleted(true);
      setStatus(current => current ? { ...current, enabled: true, verified: true } : current);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to verify authenticator."); }
    finally { setBusy(false); }
  }
  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await send("disable", { password: String(form.get("password") || ""), code: String(form.get("code") || "") });
      router.replace("/login"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to disable MFA."); }
    finally { setBusy(false); }
  }
  const codeField = <label className="en-field"><span>Authenticator code</span>
    <input name="code" required pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" inputMode="numeric" disabled={busy}/></label>;

  return <section className="en-panel" style={{ marginTop: 20 }}>
    <div className="en-panel-header"><div><p className="en-eyebrow">MULTI-FACTOR AUTHENTICATION</p>
      <h2>Authenticator protection</h2><small>Supabase time-based six-digit authenticator codes.</small></div>
      <span className={"en-badge " + (status?.enabled ? "en-state-approved" : "")}>{!status ? "Checking…" : status.enabled ? "Enabled" : "Not enabled"}</span>
    </div>
    <div className="en-form" style={{ paddingTop: 0 }}>
      {error && <p className="en-alert" role="alert">{error}<button type="button" onClick={() => void reload()}>Retry status</button></p>}
      {!status && !error && <p role="status">Loading security settings…</p>}
      {completed ? <>
        <p className="en-help"><strong>Authenticator verified.</strong> This session has completed MFA. Keep your authenticator available for future sign-ins. Contact your administrator if you lose access; this application does not issue recovery codes.</p>
        <button className="en-primary" type="button" onClick={() => { router.replace(continueHref); router.refresh(); }}>Continue →</button>
      </> : pending ? <>
        <p className="en-help">Add this manual key to your authenticator, then enter its current six-digit code. This secret is displayed only during setup.</p>
        <label className="en-field"><span>Setup secret</span><code style={{ background: "#edf8f4", padding: 14, borderRadius: 8, letterSpacing: 2, overflowWrap: "anywhere" }}>{pending.secret}</code></label>
        <form onSubmit={confirm} className="stack">{codeField}<button disabled={busy} className="en-primary">{busy ? "Verifying…" : "Verify and enable MFA →"}</button></form>
        <button type="button" className="en-secondary" disabled={busy} onClick={() => setPending(null)}>Start over</button>
      </> : status && !status.enabled ? <form onSubmit={start} className="stack">
        <p className="en-help">Confirm your current password to set up an authenticator.</p>
        <label className="en-field"><span>Current password</span><input name="password" type="password" autoComplete="current-password" maxLength={1024} required disabled={busy}/></label>
        <button disabled={busy} className="en-primary">{busy ? "Starting…" : "Set up authenticator →"}</button>
      </form> : status ? <>
        <p className="en-help">{status.verified ? "MFA is active and verified for this session." : "Verify your authenticator to continue to protected business records."}</p>
        {!status.verified && <form onSubmit={confirm} className="stack">{codeField}<button disabled={busy} className="en-primary">Verify authenticator →</button></form>}
        {status.required ? <p className="en-help">Workspace policy requires MFA. Contact your administrator for secure recovery.</p> : <form onSubmit={disable} className="stack">
          <label className="en-field"><span>Current password</span><input name="password" type="password" autoComplete="current-password" required disabled={busy}/></label>
          {codeField}<button disabled={busy} className="en-secondary">Disable MFA and sign out</button>
        </form>}
      </> : null}
    </div>
  </section>;
}
