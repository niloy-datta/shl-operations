import { requireWorkspaceAccess } from "@/lib/workspace-access";
import {ProfitabilityDesk} from "./profitability-desk";
import "../../enterprise/enterprise.css";
import "../../growth/growth.css";
import "../costs.css";
export default async function Profitability(){
  await requireWorkspaceAccess();
  return <ProfitabilityDesk/>;
}
