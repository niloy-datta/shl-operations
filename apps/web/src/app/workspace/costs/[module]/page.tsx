import { notFound } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import {CostDesk} from "../cost-desk";
import "../../enterprise/enterprise.css";
import "../../growth/growth.css";
import "../costs.css";
export default async function Costs({params}:{params:Promise<{module:string}>}){
  await requireWorkspaceAccess();
  const {module}=await params;
  if(!["expenses","commissions"].includes(module))notFound();
  return <CostDesk module={module as "expenses"|"commissions"}/>;
}
