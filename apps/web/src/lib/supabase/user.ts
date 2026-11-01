import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessWorkspace } from "./access";

export async function verifiedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !canAccessWorkspace(data.user.email)) return null;
  if (data.user.factors?.some(factor => factor.status === "verified")) {
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") return null;
  }
  return data.user;
}
