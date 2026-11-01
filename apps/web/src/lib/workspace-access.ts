import { redirect } from "next/navigation";
import { cache } from "react";
import { getSupabaseConfig } from "./supabase/config";
import { createClient } from "./supabase/server";
import { verifiedIdentity, verifiedUser } from "./supabase/user";

export const requireWorkspaceAccess = cache(async () => {
  if (!getSupabaseConfig()) redirect("/login");
  const user = await verifiedUser(await createClient());
  if (!user) redirect("/login");
  return user;
});

export const requireIdentityAccess = cache(async () => {
  if (!getSupabaseConfig()) redirect("/login");
  const user = await verifiedIdentity(await createClient());
  if (!user) redirect("/login");
  return user;
});
