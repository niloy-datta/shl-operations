import Link from "next/link";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { PasswordForm } from "./password-form";
import "../enterprise/enterprise.css";

export default async function AccountSettings() {
  const user = await requireWorkspaceAccess();
  return <div className="en-app"><div className="en-main">
    <header className="en-topbar"><div>SHL Operations <span>/</span> <strong>Account security</strong></div>
      <Link href="/workspace">← Back to workspace</Link></header>
    <main className="en-content" style={{maxWidth:880}}>
      <div className="en-heading"><div><p className="en-eyebrow">PRIVATE ACCOUNT</p>
        <h1>Account security<span>.</span></h1>
        <p>Signed in as {user.email}. Update your account password below.</p></div></div>
      <div className="en-panel"><PasswordForm /></div>
      <p className="en-disclaimer">Changing your password signs you out on all devices. Sign in again with your new password.</p>
    </main>
  </div></div>;
}
