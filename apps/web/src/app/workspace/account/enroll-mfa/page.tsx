import { redirect } from "next/navigation";
import { requireIdentityAccess } from "@/lib/workspace-access";

export default async function EnrollMfaPage() {
  await requireIdentityAccess();
  redirect("/workspace/account");
}
