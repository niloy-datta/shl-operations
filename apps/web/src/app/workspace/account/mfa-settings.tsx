"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Status = { enabled: boolean; enrollmentPending: boolean; recoveryCodesRemaining: number };
type Enrollment = { secret: string; otpAuthUrl: string };

async function send(path: string, data: Record<string,string>): Promise<Response> {
  return fetch("/api/auth/mfa/"+path, {
    method: "POST", headers: { "content-type":"application/json" },
    body:JSON.stringify(data)
  });
}

export function MfaSettings() {
  const router=useRouter();
  const [status,setStatus]=useState<Status|null>(null);
  const [pending,setPending]=useState<Enrollment|null>(null);
  const [recoveryCodes,setRecoveryCodes]=useState<string[]|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const reload=useCallback(async()=>{
    const result=await fetch("/api/auth/mfa/status",{cache:"no-store"});
    if(result.status===401){router.replace("/login");return;}
    if(!result.ok){setError("Could not check MFA settings.");return;}
    setStatus(await result.json() as Status);
  },[router]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{void reload();});
    return ()=>cancelAnimationFrame(frame);},[reload]);

  async function start(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const form=new FormData(event.currentTarget);
      const response=await send("enroll",{password:String(form.get("password")??"")});
      if(!response.ok)throw new Error(response.status===503?
        "MFA encryption key is not configured on the server.":"Password invalid or MFA setup unavailable.");
      setPending(await response.json() as Enrollment);
    }catch(e){setError(e instanceof Error?e.message:"Unable to begin setup.");}
    finally{setBusy(false);}
  }

  async function confirm(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const form=new FormData(event.currentTarget);
      const response=await send("confirm",{code:String(form.get("code")??"")});
      if(!response.ok)throw new Error("Invalid code or expired setup. Start again if necessary.");
      const data=await response.json() as {recoveryCodes:string[]};
      setPending(null);
      setRecoveryCodes(data.recoveryCodes);
      setStatus(s=>s?{...s,enabled:true}:s);
    }catch(e){setError(e instanceof Error?e.message:"Unable to confirm MFA.");}
    finally{setBusy(false);}
  }

  async function disable(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const form=new FormData(event.currentTarget);
      const response=await send("disable",{
        password:String(form.get("password")??""),code:String(form.get("code")??"")
      });
      if(!response.ok)throw new Error("Could not disable MFA. Check your password and code.");
      await fetch("/api/auth/logout",{method:"POST"});
      router.replace("/login");router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Could not disable MFA.");}
    finally{setBusy(false);}
  }
  async function finish() {
    await fetch("/api/auth/logout",{method:"POST"});
    router.replace("/login");router.refresh();
  }
  return <section className="en-panel" style={{marginTop:20}}>
    <div className="en-panel-header"><div><p className="en-eyebrow">MULTI-FACTOR AUTHENTICATION</p>
      <h2>Authenticator protection</h2><small>Time-based 6-digit codes, with one-use recovery codes.</small>
    </div><span className={"en-badge "+(status?.enabled?"en-state-approved":"")}>
      {status?.enabled?"Enabled":"Not enabled"}</span></div>
    <div className="en-form" style={{paddingTop:0}}>
      {error&&<p className="en-alert" role="alert">{error}</p>}
      {!status&&!error&&<p className="en-help">Loading security settings…</p>}
      {recoveryCodes ? <>
        <p className="en-help"><strong>MFA is enabled.</strong> Save these recovery codes in a password manager now. They will not be displayed again. Existing sessions have been revoked.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}>
          {recoveryCodes.map(code=><code key={code} style={{padding:11,background:"#edf8f4",borderRadius:7,fontSize:13}}>{code}</code>)}
        </div>
        <button type="button" className="en-secondary" onClick={()=>{
          void navigator.clipboard.writeText(recoveryCodes.join("\n")).catch(()=>setError("Copy unavailable. Record codes manually."));
        }}>Copy recovery codes</button>
        <button className="en-primary" onClick={()=>void finish()}>I saved my codes — sign in again →</button>
      </> : pending ? <>
        <p className="en-help">Add the manual key below to any compatible authenticator app (30-second, SHA1, 6 digits). Then enter the current code.</p>
        <label className="en-field"><span>One-time setup secret</span><code style={{
          background:"#edf8f4",padding:14,borderRadius:8,letterSpacing:2,overflowWrap:"anywhere"
        }}>{pending.secret}</code></label>
        <form onSubmit={e=>void confirm(e)} style={{display:"grid",gap:12}}>
          <label className="en-field"><span>Authenticator code</span><input name="code" required pattern="[0-9]{6}" autoComplete="one-time-code" inputMode="numeric"/></label>
          <button disabled={busy} className="en-primary">{busy?"Verifying…":"Verify and enable MFA →"}</button>
        </form>
        <button className="en-secondary" onClick={()=>setPending(null)}>Start over</button>
      </> : status && !status.enabled ? <>
        <p className="en-help">Enable MFA with your current password. Your authenticator secret will be shown only during setup.</p>
        <form onSubmit={e=>void start(e)} style={{display:"grid",gap:12}}>
          <label className="en-field"><span>Confirm current password</span>
            <input name="password" type="password" autoComplete="current-password" required/></label>
          <button disabled={busy} className="en-primary">{busy?"Starting…":"Set up authenticator →"}</button>
        </form>
      </> : status ? <>
        <p className="en-help">MFA is active. {status.recoveryCodesRemaining} unused recovery codes remain. Disabling requires your password and an authenticator or recovery code.</p>
        <form onSubmit={e=>void disable(e)} style={{display:"grid",gap:12}}>
          <label className="en-field"><span>Current password</span>
            <input name="password" type="password" autoComplete="current-password" required/></label>
          <label className="en-field"><span>Authenticator or recovery code</span>
            <input name="code" autoComplete="one-time-code" required maxLength={40}/></label>
          <button disabled={busy} className="en-secondary">{busy?"Disabling…":"Disable MFA and sign out"}</button>
        </form>
      </> : null}
    </div>
  </section>;
}
