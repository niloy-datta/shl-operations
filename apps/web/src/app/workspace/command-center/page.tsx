import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { ExecutiveCockpit } from "./executive-cockpit";
import "./cockpit.css";

export default async function CommandCenterPage(){
  if(!await sessionAuthorization())redirect("/login");
  return <ExecutiveCockpit/>;
}
