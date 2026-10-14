import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { EntityRegistry } from "./entity-registry";
import "../consignees/consignees.css";
import "./entities.css";

export default async function EntityDirectoryPage() {
  if(!await sessionAuthorization()) redirect("/login");
  return <EntityRegistry/>;
}
