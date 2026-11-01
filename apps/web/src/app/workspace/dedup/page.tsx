import { requireWorkspaceAccess } from "@/lib/workspace-access";
import {DedupReviewDesk} from "./dedup-review-desk";
import "./dedup.css";

export default async function DuplicateReviewPage(){
  await requireWorkspaceAccess();
  return <DedupReviewDesk/>;
}
