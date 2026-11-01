import { notFound } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { EnterpriseDesk } from "../enterprise-desk";
import "../enterprise.css";

const modules = new Set(["quotes","orders","purchase-orders","shipments","invoices","tasks","staff","audit"]);

export default async function EnterpriseModulePage({ params }: { params: Promise<{ module: string }> }) {
  await requireWorkspaceAccess();
  const { module } = await params;
  if (!modules.has(module)) notFound();
  return <EnterpriseDesk currentModule={module} />;
}
