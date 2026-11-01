"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AccountForm({ mode }: { mode: "register" | "recover" | "set-password" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const needsPassword = mode !== "recover";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    setError(""); setMessage("");
    if (needsPassword && password !== form.get("confirm")) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Unable to complete this request."); return; }
      if (mode === "set-password") { router.replace("/login?passwordUpdated=1"); router.refresh(); return; }
      if (data.signedIn) { router.replace("/workspace"); router.refresh(); return; }
      setMessage(data.message);
    } catch { setError("Unable to reach the service. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="stack" onSubmit={submit}>
    {mode !== "set-password" && <label>Email<input name="email" type="email" autoComplete="username" placeholder="Your authorized staff email" required maxLength={254} disabled={busy} /></label>}
    {needsPassword && <>
      <label>New password<input name="password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={16} maxLength={128} required disabled={busy} aria-describedby="password-help" /></label>
      <label>Confirm password<input name="confirm" type={visible ? "text" : "password"} autoComplete="new-password" minLength={16} maxLength={128} required disabled={busy} /></label>
      <p id="password-help" className="muted">Use 16–128 characters. A unique passphrase or password manager is recommended.</p>
      <button type="button" className="auth-text-button" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide passwords" : "Show passwords"}</button>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="auth-notice" role="status">{message}</p>}
    <button className="primary" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account →" : mode === "recover" ? "Send reset link →" : "Save password →"}</button>
    <Link href="/login" className="auth-link">← Back to sign in</Link>
  </form>;
}
