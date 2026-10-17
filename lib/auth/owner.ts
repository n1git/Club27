import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireRole, requireActionRole, UnauthorizedError } from "./guard";

export interface OwnerContext {
  ownerId: string;
  accountId: string;
  organizationId: string;
  profileId: string;
  tenantId: string;
  baseRole: "p_owner" | "owner";
}

export async function loadOwner(profileId: string, tenantId: string): Promise<OwnerContext | null> {
  const { data } = await createAdminSupabaseClient()
    .from("club_profiles")
    .select("owner_id, account_id, organization_members:organization_users(id, organization_id, is_active, base_role)")
    .eq("id", profileId)
    .eq("club_id", tenantId)
    .not("owner_id", "is", null)
    .maybeSingle();
  const owner = data?.organization_members as unknown as { id: string; organization_id: string; is_active: boolean; base_role: "p_owner" | "owner" } | null;
  if (!owner?.is_active) return null;
  return { ownerId: owner.id, accountId: data!.account_id as string, organizationId: owner.organization_id, profileId, tenantId, baseRole: owner.base_role };
}

export async function requireOwner() {
  const user = await requireRole("owner");
  const owner = await loadOwner(user.id, user.tenantId);
  if (!owner) redirect("/admin");
  return { ...user, ...owner };
}

export async function requireOwnerAction(options: { allowBillingLocked?: boolean } = {}): Promise<OwnerContext> {
  const session = await requireActionRole("owner", options);
  const owner = await loadOwner(session.sub, session.club_id);
  if (!owner) throw new UnauthorizedError("Hanya pemilik organisasi yang dapat melakukan aksi ini");
  return owner;
}

export async function requirePrimaryOwnerAction(): Promise<OwnerContext> {
  const owner = await requireOwnerAction();
  if (owner.baseRole !== "p_owner") throw new UnauthorizedError("Hanya pemilik utama yang dapat melakukan aksi ini");
  return owner;
}
