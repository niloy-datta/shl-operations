import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { ConsigneeWorkspace } from "./consignee-workspace";
import "./consignees.css";

export default async function ConsigneesPage() {
  if (!await sessionAuthorization()) redirect("/login");
  return <ConsigneeWorkspace />;
}
