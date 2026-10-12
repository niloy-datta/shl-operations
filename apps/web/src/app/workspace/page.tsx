import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { Workspace } from "./workspace";
export default async function WorkspacePage() {
  if (!await sessionAuthorization()) redirect("/login");
  return <Workspace />;
}
