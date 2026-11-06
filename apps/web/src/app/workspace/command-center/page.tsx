import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { NexusOverview } from "@/components/nexus-overview";
import "./cockpit.css";
import "./daily-desk.css";

export default async function CommandCenterPage(){
  if(!await sessionAuthorization())redirect("/login");
  return <NexusOverview executive/>;
}
