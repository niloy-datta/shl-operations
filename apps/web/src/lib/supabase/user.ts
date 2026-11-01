import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessWorkspace } from "./access";

export async function verifiedIdentity(client: SupabaseClient) {
  try {
    const { data, error } = await client.auth.getUser();
    return error || !data.user || !canAccessWorkspace(data.user.email) ? null : data.user;
  } catch { return null; }
}

export async function verifiedUser(client: SupabaseClient) {
  const user = await verifiedIdentity(client);
  if (!user) return null;
  if (user.factors?.some(factor => factor.status === "verified")) {
    try {
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2") return null;
    } catch { return null; }
  }
  return user;
}
