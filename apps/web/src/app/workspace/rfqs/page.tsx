import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { RfqWorkspace } from "./rfq-workspace";
import "./rfqs.css";

export default async function RfqsPage() {
  await requireWorkspaceAccess();
  return <RfqWorkspace />;
}
