export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  createdAt: string;
};
export type ContactPage = { content: Contact[]; totalElements: number; totalPages: number };
export type Totals = { customers: number; suppliers: number; rfqs: number };
export type ServiceIssue = { title: string; message: string; unauthorized?: boolean };

export class RequestError extends Error {
  constructor(public issue: ServiceIssue) { super(issue.message); }
}

export async function accessDeniedMessage(response: Response, fallback: string) {
  const body = await response.clone().json().catch(() => null);
  if (body?.code === "MFA_REQUIRED") return "Open My security (/workspace/account) to set up or verify your authenticator, then retry.";
  if (body?.code === "STAFF_ACCESS_REQUIRED") return "Ask your administrator to link your Supabase identity to an enabled staff account.";
  return fallback;
}

export async function readService<T>(url: string, signal: AbortSignal, valid: (value: unknown) => value is T): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { cache: "no-store", signal }); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new RequestError({ title: "Connection problem", message: "The service could not be reached. Check your connection and try again." });
  }
  if (response.status === 401) throw new RequestError({ title: "Session expired", message: "Please sign in again.", unauthorized: true });
  if (response.status === 403) {
    const error = await response.json().catch(() => null);
    if (error?.code === "MFA_REQUIRED") throw new RequestError({ title: "Authenticator verification required", message: "Open My security to set up or verify your authenticator, then retry." });
    if (error?.code === "STAFF_ACCESS_REQUIRED") throw new RequestError({ title: "Staff access required", message: "Ask your administrator to link your Supabase identity to an enabled staff account." });
    throw new RequestError({ title: "Access restricted", message: "You do not have permission to access this service." });
  }
  if (response.status === 404) throw new RequestError({ title: "Service not connected yet", message: "This service is not available yet. Please try again later." });
  if (response.status >= 500) {
    const body = await response.json().catch(() => null);
    if (body?.code === "SERVICE_NOT_CONFIGURED") throw new RequestError({ title: "Service not connected yet", message: "The business data service has not been connected. Records are unavailable." });
    throw new RequestError({ title: "Service temporarily unavailable", message: "The service encountered a server error. Please try again later." });
  }
  if (!response.ok) throw new RequestError({ title: "Request failed", message: `The service returned HTTP ${response.status}. Please try again.` });
  let value: unknown;
  try { value = await response.json(); }
  catch { throw new RequestError({ title: "Invalid service response", message: "The service returned invalid JSON. Please try again later." }); }
  if (!valid(value)) throw new RequestError({ title: "Invalid service response", message: "The service returned data in an unexpected format." });
  return value;
}

export function isTotals(value: unknown): value is Totals {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return [record.customers, record.suppliers, record.rfqs].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);
}

export function isContactPage(value: unknown): value is ContactPage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.content) && record.content.every((item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const contact = item as Record<string, unknown>;
    return typeof contact.id === "string" && typeof contact.name === "string" && typeof contact.createdAt === "string" &&
      [contact.email, contact.phone, contact.country].every(field => field == null || typeof field === "string");
  }) && typeof record.totalElements === "number" && Number.isInteger(record.totalElements) && record.totalElements >= 0 &&
    typeof record.totalPages === "number" && Number.isInteger(record.totalPages) && record.totalPages >= 0;
}
