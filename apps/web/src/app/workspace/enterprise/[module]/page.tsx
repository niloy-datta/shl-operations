import { redirect, notFound } from "next/navigation";
import { sessionAuthorization } from "@/lib/session";
import { EnterpriseDesk } from "../enterprise-desk";
import "../enterprise.css";

const modules = new Set(["quotes","orders","purchase-orders","shipments","invoices","tasks","staff","audit"]);

export default async function EnterpriseModulePage({ params }: { params: Promise<{ module: string }> }) {
  if (!await sessionAuthorization()) redirect("/login");
  const { module } = await params;
  if (!modules.has(module)) notFound();
  return <EnterpriseDesk currentModule={module} />;
}
