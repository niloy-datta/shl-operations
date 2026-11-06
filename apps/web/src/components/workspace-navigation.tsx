"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { visibleNavigation } from "@/lib/operations-navigation";
import { useId, useState } from "react";
import { useWorkspaceIdentity } from "./workspace-identity";

export function WorkspaceNavigation({ role, commissionAccess, variant = "enterprise" }: {
  role?: string | null; commissionAccess?: boolean; variant?: "workspace" | "enterprise" | "desk" | "cockpit";
}) {
  const identity = useWorkspaceIdentity();
  const pathname = usePathname();
  const query = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const current = pathname + (pathname === "/workspace" && query.get("view")
    ? "?view=" + query.get("view") : "");
  const itemClass = variant === "workspace" ? "nav-item" : variant === "cockpit" ? "cc-link" : "en-nav-item";
  return <nav aria-label="Business modules" className={"os-en-navigation"+(variant==="desk"?" desk-nav":"")}>
    <button type="button" className="os-nav-toggle" aria-expanded={expanded} aria-controls={id}
      onClick={() => setExpanded(value => !value)}>Workspace modules <span aria-hidden="true">{expanded ? "−" : "+"}</span></button>
    <div id={id} className={"os-navigation-groups" + (expanded ? " is-expanded" : "")}>
    {visibleNavigation(role ?? identity.staff?.role, commissionAccess ?? identity.commissionAccess).map(group => <div className="os-en-group" key={group.label}>
      <p className={variant === "workspace" ? "nav-heading" : "os-en-group-label"}>{group.label}</p>
      {group.items.map(item => <Link key={item.href} href={item.href}
        onClick={() => setExpanded(false)}
        aria-current={current === item.href ? "page" : undefined}
        className={itemClass +
          (current === item.href ? variant === "workspace" ? " selected" : " active" : "")}>
        <span className="en-nav-symbol" aria-hidden="true">{item.symbol}</span><span>{item.label}</span>
      </Link>)}
    </div>)}
    </div>
  </nav>;
}
