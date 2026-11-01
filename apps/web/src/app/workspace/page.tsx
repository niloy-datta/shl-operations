import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { Workspace } from "./workspace";
export default async function WorkspacePage() {
  await requireWorkspaceAccess();
  return <Workspace />;
}
