import {notFound,redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {CostDesk} from "../cost-desk";
import "../../enterprise/enterprise.css";
import "../../growth/growth.css";
import "../costs.css";
export default async function Costs({params}:{params:Promise<{module:string}>}){
  if(!await sessionAuthorization())redirect("/login");
  const {module}=await params;
  if(!["expenses","commissions"].includes(module))notFound();
  return <CostDesk module={module as "expenses"|"commissions"}/>;
}
