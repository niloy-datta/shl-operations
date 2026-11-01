import { redirect } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/workspace-access";

export default async function EnrollMfaPage() {
  await requireWorkspaceAccess();
  redirect("/workspace/account");
}