import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { NexusShell } from "@/components/nexus-shell";
import { WorkspaceIdentity } from "@/components/workspace-identity";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (!await sessionAuthorization()) redirect("/login");
  return <WorkspaceIdentity><NexusShell initialTheme={(await cookies()).get("shl_nexus_theme")?.value==="dark"?"dark":"light"}>{children}</NexusShell></WorkspaceIdentity>;
}
