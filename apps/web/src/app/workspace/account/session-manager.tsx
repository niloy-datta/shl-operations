"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Session = { id: string; created_at: string; expires_at: string; current: boolean };

export function SessionManager() {
  const router = useRouter();
  const [sessions,setSessions] = useState<Session[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string|null>(null);
  const [error,setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/sessions", { cache:"no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error("Could not load active sessions.");
      setSessions(await response.json() as Session[]);
      setError("");
    } catch {
      setError("Could not load active sessions.");
    } finally { setLoading(false); }
  },[router]);
  useEffect(() => {
    const frame=requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  },[load]);

  async function revoke(session:Session) {
    setBusy(session.id);setError("");
    try {
      const response=await fetch("/api/auth/sessions/"+session.id, { method:"DELETE" });
      if (!response.ok) throw new Error("Could not revoke session.");
      if (session.current) {
        await fetch("/api/auth/logout",{method:"POST"});
        router.replace("/login");router.refresh();
      } else {
        setSessions(existing=>existing.filter(item=>item.id!==session.id));
      }
    } catch { setError("Could not revoke session. Please retry."); }
    finally { setBusy(null); }
  }
  return <section className="en-panel" style={{ marginTop:20 }}>
    <div className="en-panel-header"><div><p className="en-eyebrow">SESSION MANAGEMENT</p>
      <h2>Active sign-ins</h2><small>View and revoke other signed-in devices.</small></div>
      <button className="en-secondary" disabled={loading} onClick={()=>void load()}>Refresh</button></div>
    <div style={{padding:"0 25px 23px"}}>
      {loading && <p className="en-help">Loading active sessions…</p>}
      {error && <p className="en-alert" role="alert">{error}</p>}
      {!loading && sessions.length===0 && <p className="en-help">No active sessions found.</p>}
      {sessions.map(session=><div key={session.id} style={{
        display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",
        borderTop:"1px solid #e5ecf3",padding:"15px 0",flexWrap:"wrap"
      }}>
        <div><strong style={{fontSize:13}}>{session.current?"This device":"Other sign-in"}</strong>
          <p style={{fontSize:11,color:"#8292a5",margin:"6px 0"}}>
            Started {new Date(session.created_at).toLocaleString()} · Expires {new Date(session.expires_at).toLocaleString()}
          </p></div>
        <button className="en-secondary" disabled={busy!==null}
          onClick={()=>void revoke(session)}>
          {busy===session.id?"Revoking…":session.current?"Sign out this device":"Revoke access"}
        </button>
      </div>)}
    </div>
  </section>;
}
