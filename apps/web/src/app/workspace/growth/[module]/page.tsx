import { notFound } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { GrowthDesk } from "../growth-desk";
import "../../enterprise/enterprise.css";
import "../growth.css";

export default async function GrowthModule({params}:{params:Promise<{module:string}>}){
  await requireWorkspaceAccess();
  const {module}=await params;
  if(!["leads","projects"].includes(module))notFound();
  return <GrowthDesk module={module as "leads"|"projects"}/>;
}
