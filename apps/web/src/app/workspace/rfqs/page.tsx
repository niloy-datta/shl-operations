import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { RfqWorkspace } from "./rfq-workspace";
import "./rfqs.css";

export default async function RfqsPage() {
  if (!await sessionAuthorization()) redirect("/login");
  return <RfqWorkspace />;
}
