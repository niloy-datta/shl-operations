"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export function LoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.has("error")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setError("This email link is invalid or expired. Use Forgot password to request a fresh link.");
      return;
    }
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    if (!accessToken || !refreshToken) return;
    // Remove tokens immediately; never include them in URLs sent to the server.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setBusy(true);
    fetch("/api/auth/email-session", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken }) })
      .then(async response => {
        if (!response.ok) { const data = await response.json(); setError(data.error || "Unable to verify the email link."); return; }
        router.replace("/reset-password"); router.refresh();
      }).catch(() => setError("Unable to verify the email link. Please try again."))
      .finally(() => setBusy(false));
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), code: form.get("code") || undefined }) });
      if (response.status === 428) {
        setMfaRequired(true); setError("Enter your six-digit authenticator code."); return;
      }
      if (!response.ok) { setError((await response.json()).error || "Sign in failed"); return; }
      router.replace("/workspace");
      router.refresh();
    } catch { setError("Unable to reach the service"); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="stack">
    <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} disabled={!configured || busy} /></label>
    <label>Password<input name="password" type={visible ? "text" : "password"} autoComplete="current-password" required disabled={!configured || busy} /></label>
    <div className="auth-actions"><button type="button" className="auth-text-button" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide password" : "Show password"}</button><Link href="/forgot-password" className="auth-link">Forgot password?</Link></div>
    {mfaRequired && <label>Authenticator code
      <input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
        placeholder="123456" required />
    </label>}
    {error && <p role="alert" className="error">{error}</p>}
    {!configured && <p role="status" className="muted">Sign in will be available once your Supabase project is connected.</p>}
    <button className="primary" disabled={!configured || busy}>{busy ? "Signing in…" : "Sign in →"}</button>
    <p className="muted">First time here? <Link href="/register" className="auth-link">Set up your account →</Link></p>
  </form>;
}
