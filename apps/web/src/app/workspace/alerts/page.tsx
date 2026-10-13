import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {AlertsDesk} from "./alerts-desk";
import "../enterprise/enterprise.css";
import "../growth/growth.css";
import "./alerts.css";
export default async function AlertsPage(){
  if(!await sessionAuthorization())redirect("/login");
  return <AlertsDesk/>;
}
