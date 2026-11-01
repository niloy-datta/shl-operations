import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { ExecutiveCockpit } from "./executive-cockpit";
import "./cockpit.css";
import "./daily-desk.css";
import "./quick-switcher.css";

export default async function CommandCenterPage(){
  await requireWorkspaceAccess();
  return <ExecutiveCockpit/>;
}
