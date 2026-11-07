import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { NexusShell } from "@/components/nexus-shell";
import { WorkspaceIdentity } from "@/components/workspace-identity";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (!await sessionAuthorization()) redirect("/login");
  const theme=(await cookies()).get("shl_nexus_theme")?.value;
  return <WorkspaceIdentity><NexusShell initialTheme={theme==="light"?"light":"dark"}>{children}</NexusShell></WorkspaceIdentity>;
}
