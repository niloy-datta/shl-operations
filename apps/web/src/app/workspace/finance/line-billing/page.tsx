import { requireWorkspaceAccess } from "@/lib/workspace-access";
import {BillingDesk} from "./billing-desk";
import "./billing.css";

export default async function LineBillingPage(){
  await requireWorkspaceAccess();
  return <BillingDesk/>;
}
