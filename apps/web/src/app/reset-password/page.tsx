import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifiedIdentity, verifiedUser } from "@/lib/supabase/user";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { AccountForm } from "../login/account-form";
import Link from "next/link";
import { MfaSettings } from "../workspace/account/mfa-settings";
import "../workspace/enterprise/enterprise.css";

export default async function ResetPasswordPage() {
  if (!getSupabaseConfig()) redirect("/login");
  const client = await createClient();
  const identity = await verifiedIdentity(client);
  const user = identity ? await verifiedUser(client) : null;
  return <main className="login-screen"><div className="login-card">
    <div className="brand-mark">SHL<span>.</span></div>
    <p className="eyebrow">ACCOUNT SECURITY</p><h1>Set your password.</h1>
    {user ? <><p className="muted">Choose a new password for {user.email}. If you just confirmed your account and already chose a password, you can <Link href="/workspace">continue to your workspace</Link>.</p><AccountForm mode="set-password" /></> : identity ? <>
      <p className="muted">Verify your authenticator before changing your password.</p><MfaSettings continueHref="/reset-password" /></> :
      <><p className="error" role="alert">This link has expired or was opened in another browser.</p><Link className="auth-link" href="/forgot-password">Request a fresh reset link →</Link></>}
  </div></main>;
}
