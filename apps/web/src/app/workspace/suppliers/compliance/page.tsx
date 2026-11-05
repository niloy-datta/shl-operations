import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {SupplierComplianceDesk} from "./supplier-compliance-desk";
import "./supplier-compliance.css";

export default async function SupplierCompliancePage()
{
  if (!await sessionAuthorization())
  {
    redirect("/login");
  }
  return <SupplierComplianceDesk/>;
}
