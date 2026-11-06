"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

type Staff = { username: string; role: string };
const Identity = createContext<{ staff: Staff | null; commissionAccess: boolean }>({
  staff: null, commissionAccess: false,
});

export function WorkspaceIdentity({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [identity, setIdentity] = useState<{ staff: Staff | null; commissionAccess: boolean }>({
    staff: null, commissionAccess: false,
  });
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (pathname === "/workspace/account/enroll-mfa") return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/data/me", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { router.replace("/login"); return; }
        if (response.status === 403) { router.replace("/workspace/account/enroll-mfa"); return; }
        if (!response.ok) throw new Error("Account information is unavailable. Please retry.");
        const staff = await response.json() as Staff;
        if (typeof staff.username !== "string" || typeof staff.role !== "string")
          throw new Error("Account information is unavailable. Please retry.");
        const access = await fetch("/api/costs/commissions/access", {
          cache: "no-store", signal: controller.signal,
        });
        const data = access.ok ? await access.json() as { allowed?: boolean } : null;
        if (!controller.signal.aborted) {
          setIdentity({ staff, commissionAccess: data?.allowed === true });
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setIdentity({ staff: null, commissionAccess: false });
          setError("Account information is unavailable. Please retry.");
        }
      }
    })();
    return () => controller.abort();
  }, [pathname, retry, router]);
  return <Identity.Provider value={identity}>
    {error && <div className="os-feedback" role="alert" data-kind="error">
      <span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>
    </div>}
    {children}
  </Identity.Provider>;
}

export const useWorkspaceIdentity = () => useContext(Identity);
