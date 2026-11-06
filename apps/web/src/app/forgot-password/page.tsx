import Link from "next/link";

export default function ForgotPassword() {
  return <main className="login-screen">
    <div className="login-card">
      <div className="brand-mark">SHL<span>.</span></div>
      <p className="eyebrow">SECURE ACCOUNT RECOVERY</p>
      <h1>Forgot your password?</h1>
      <p className="muted">SHL staff accounts use administrator-verified password recovery. We do not send reset links to unverified addresses.</p>
      <div className="recovery-guidance">
        <strong>How to regain access</strong>
        <p>Contact your SHL administrator through your usual internal channel and request a password reset. The administrator will verify your identity, open Staff &amp; access, and set a temporary password.</p>
        <p>Never share your current password or authenticator recovery codes. An administrator will not ask for them.</p>
      </div>
      <p className="muted">If you can still sign in, you can change your password in Account security.</p>
      <Link href="/login" className="recovery-back-link">← Back to sign in</Link>
    </div>
  </main>;
}
