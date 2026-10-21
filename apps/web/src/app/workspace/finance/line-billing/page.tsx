import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {BillingDesk} from "./billing-desk";
import "./billing.css";

export default async function LineBillingPage(){
  if(!await sessionAuthorization())redirect("/login");
  return <BillingDesk/>;
}
