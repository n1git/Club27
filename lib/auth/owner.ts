import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireRole, requireActionRole, UnauthorizedError } from "./guard";

export interface OwnerContext {
  ownerId: string;
  accountId: string;
  organizationId: string;
  profileId: string;
  tenantId: string;
}

export async function loadOwner(profileId: string, tenantId: string): Promise<OwnerContext | null> {
  const { data } = await createAdminSupabaseClient()
    .from("profiles")
    .select("owner_id, account_id, org_owners(id, organization_id, is_active)")
    .eq("id", profileId)
    .eq("tenant_id", tenantId)
    .not("owner_id", "is", null)
    .maybeSingle();
  const owner = data?.org_owners as unknown as { id: string; organization_id: string; is_active: boolean } | null;
  if (!owner?.is_active) return null;
  return { ownerId: owner.id, accountId: data!.account_id as string, organizationId: owner.organization_id, profileId, tenantId };
}

export async function requireOwner() {
  const user = await requireRole("admin");
  const owner = await loadOwner(user.id, user.tenantId);
  if (!owner) redirect("/admin");
  return { ...user, ...owner };
}

export async function requireOwnerAction(options: { allowBillingLocked?: boolean } = {}): Promise<OwnerContext> {
  const session = await requireActionRole("admin", options);
  const owner = await loadOwner(session.sub, session.tenant_id);
  if (!owner) throw new UnauthorizedError("Hanya pemilik organisasi yang dapat melakukan aksi ini");
  return owner;
}
