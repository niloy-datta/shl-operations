import { notFound, redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { GrowthDesk } from "../growth-desk";
import "../../enterprise/enterprise.css";
import "../growth.css";

export default async function GrowthModule({params}:{params:Promise<{module:string}>}){
  if(!await sessionAuthorization())redirect("/login");
  const {module}=await params;
  if(!["leads","projects"].includes(module))notFound();
  return <GrowthDesk module={module as "leads"|"projects"}/>;
}
