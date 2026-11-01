import "server-only";
import { backendOrigin } from "./api-routing";

export async function backendRequest(path: string, accessToken: string, init: RequestInit = {}) {
  const origin = backendOrigin(process.env.API_INTERNAL_URL);
  if (!origin) throw new Error("BACKEND_NOT_CONFIGURED");
  if (!path.startsWith("/api/") || path.split("?")[0].includes("..")) throw new Error("INVALID_BACKEND_PATH");
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + accessToken);
  headers.set("Accept", "application/json");
  return fetch(new URL(path, origin), { ...init, headers, cache: "no-store", redirect: "manual",
    signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) });
}

export async function revokeBackendSessions(accessToken: string, all = false) {
  if (!process.env.API_INTERNAL_URL) return true;
  try {
    const response = await backendRequest("/api/auth/sessions/" + (all ? "all" : "current"), accessToken, { method: "POST" });
    return response.ok || (!all && response.status === 401) || response.status === 403;
  } catch { return false; }
}
