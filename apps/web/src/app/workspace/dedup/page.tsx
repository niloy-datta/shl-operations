import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {DedupReviewDesk} from "./dedup-review-desk";
import "./dedup.css";

export default async function DuplicateReviewPage(){
  if(!await sessionAuthorization())redirect("/login");
  return <DedupReviewDesk/>;
}
