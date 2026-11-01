import { AccountForm } from "../login/account-form";

export default function ForgotPasswordPage() {
  return <main className="login-screen"><div className="login-card">
    <div className="brand-mark">SHL<span>.</span></div>
    <p className="eyebrow">ACCOUNT RECOVERY</p><h1>Forgot your password?</h1>
    <p className="muted">Enter your staff email. Open the reset link in this browser to choose a new password.</p>
    <AccountForm mode="recover" />
  </div></main>;
}
