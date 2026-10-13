import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {ProfitabilityDesk} from "./profitability-desk";
import "../../enterprise/enterprise.css";
import "../../growth/growth.css";
import "../costs.css";
export default async function Profitability(){
  if(!await sessionAuthorization())redirect("/login");
  return <ProfitabilityDesk/>;
}
