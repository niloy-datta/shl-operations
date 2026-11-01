import { LoginForm } from "./login-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
export default async function Login({ searchParams }: { searchParams: Promise<{ authError?: string; passwordUpdated?: string }> }) {
  const query = await searchParams;
  return <main className="login-screen"><div className="login-card">
    <div className="brand-mark">SHL<span>.</span></div>
    <p className="eyebrow">PRIVATE WORKSPACE</p><h1>Welcome back.</h1>
    <p className="muted">Sign in to manage your operations.</p>
    {query.authError && <p role="alert" className="error">Your email link is invalid or expired. Request a new one and open it in the same browser.</p>}
    {query.passwordUpdated && <p role="status" className="auth-notice">Password saved. Sign in with your new password.</p>}
    <LoginForm configured={Boolean(getSupabaseConfig())} />
  </div></main>;
}
