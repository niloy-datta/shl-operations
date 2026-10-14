import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { MfaSettings } from "../mfa-settings";
import "../../enterprise/enterprise.css";

export default async function EnrollMfaPage() {
  if (!await sessionAuthorization()) redirect("/login");
  return <main className="en-app"><div className="en-main">
    <div className="en-content" style={{maxWidth:760,margin:"0 auto"}}>
      <div className="en-heading"><div>
        <p className="en-eyebrow">SECURITY SETUP REQUIRED</p>
        <h1>Protect your account<span>.</span></h1>
        <p>Set up an authenticator to access SHL Operations.
          Save your recovery codes before continuing.</p>
      </div></div>
      <MfaSettings />
      <p className="en-disclaimer">
        Until enrollment is complete, this session cannot access business information.
        Sign in again with a code after you enable MFA.
      </p>
    </div>
  </div></main>;
}
