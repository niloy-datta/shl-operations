import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { ConsigneeWorkspace } from "./consignee-workspace";
import "./consignees.css";

export default async function ConsigneesPage() {
  await requireWorkspaceAccess();
  return <ConsigneeWorkspace />;
}
