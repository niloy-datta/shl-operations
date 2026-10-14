import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { PasswordForm } from "./password-form";
import { SessionManager } from "./session-manager";
import { MfaSettings } from "./mfa-settings";
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
      <MfaSettings />
      <SessionManager />
      <p className="en-disclaimer">Changing your password revokes all sessions. You can also revoke individual sessions above. Authenticator MFA may be required by your organization. When required, complete setup before accessing business workflows.</p>
    </main>
  </div></div>;
}
