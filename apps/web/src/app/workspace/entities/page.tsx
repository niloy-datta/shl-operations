import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { EntityRegistry } from "./entity-registry";
import "../consignees/consignees.css";
import "./entities.css";

export default async function EntityDirectoryPage() {
  await requireWorkspaceAccess();
  return <EntityRegistry/>;
}
