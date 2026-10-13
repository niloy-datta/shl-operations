import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { PasswordForm } from "./password-form";
import "../enterprise/enterprise.css";

export default async function AccountSettings() {
  if (!await sessionAuthorization()) redirect("/login");
  return <div className="en-app"><div className="en-main">
    <header className="en-topbar"><div>SHL Operations <span>/</span> <strong>Account security</strong></div>
      <Link href="/workspace">← Back to workspace</Link></header>
    <main className="en-content" style={{maxWidth:880}}>
      <div className="en-heading"><div><p className="en-eyebrow">PRIVATE ACCOUNT</p>
        <h1>Account security<span>.</span></h1>
        <p>Rotate your password without administrator assistance.</p></div></div>
      <div className="en-panel"><PasswordForm /></div>
      <p className="en-disclaimer">A password change signs you out. All active sessions must be separately revoked when centrally managed sessions are introduced. MFA is not yet supported.</p>
    </main>
  </div></div>;
}
