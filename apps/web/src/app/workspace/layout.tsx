import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { OperationsCommand } from "@/components/operations-command";
import { WorkspaceIdentity } from "@/components/workspace-identity";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (!await sessionAuthorization()) redirect("/login");
  return <WorkspaceIdentity>{children}<OperationsCommand /></WorkspaceIdentity>;
}
