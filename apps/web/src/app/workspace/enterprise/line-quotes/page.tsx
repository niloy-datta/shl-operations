import { redirect } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { LineQuoteDesk } from "./line-quote-desk";
import "./line-quotes.css";
import "./line-orders.css";

export default async function LineQuotesPage({
  searchParams
}: { searchParams: Promise<{ rfqId?: string }> }) {
  if (!await sessionAuthorization()) redirect("/login");
  const params=await searchParams;
  const rfqId=typeof params.rfqId==="string" ? params.rfqId : "";
  return <LineQuoteDesk rfqId={rfqId} />;
}
