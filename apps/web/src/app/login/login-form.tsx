"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function LoginForm() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password"), code: form.get("code") || undefined }) });
      if (response.status === 428) {
        setMfaRequired(true); setError("Enter the six-digit authenticator code or a recovery code."); return;
      }
      if (!response.ok) { setError((await response.json()).error || "Sign in failed"); return; }
      const session = await response.json() as { enrollmentRequired?: boolean };
      router.replace(session.enrollmentRequired ? "/workspace/account/enroll-mfa" : "/workspace");
      router.refresh();
    } catch { setError("Unable to reach the service"); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="stack">
    <label>Username<input name="username" autoComplete="username" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    {mfaRequired && <label>Authenticator or recovery code
      <input name="code" type="text" inputMode="text" autoComplete="one-time-code" maxLength={40}
        placeholder="123456 or recovery code" required />
    </label>}
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</button>
  </form>;
}

