import { AccountForm } from "../login/account-form";

export default function RegisterPage() {
  return <main className="login-screen"><div className="login-card">
    <div className="brand-mark">SHL<span>.</span></div>
    <p className="eyebrow">WORKSPACE ACCOUNT</p><h1>Set up your account.</h1>
    <p className="muted">Use your authorized staff email. Confirm the email in this browser before signing in.</p>
    <AccountForm mode="register" />
  </div></main>;
}
