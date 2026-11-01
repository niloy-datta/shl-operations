import { requireWorkspaceAccess } from "@/lib/workspace-access";
import {AlertsDesk} from "./alerts-desk";
import "../enterprise/enterprise.css";
import "../growth/growth.css";
import "./alerts.css";
export default async function AlertsPage(){
  await requireWorkspaceAccess();
  return <AlertsDesk/>;
}
