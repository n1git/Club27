import { cache } from "react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface OrgRole {
  id: string;
  name: string;
  isPaid: boolean;
  presetKey: string | null;
  permissions: string[];
  profileCount: number;
}

export const organizationIdForTenant = cache(async (tenantId: string): Promise<string | null> => {
  const { data } = await createAdminSupabaseClient().from("clubs").select("organization_id").eq("id", tenantId).maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
});

export const getOrgRoles = cache(async (organizationId: string): Promise<OrgRole[]> => {
  const supabase = createAdminSupabaseClient();
  const { data: roles } = await supabase
    .from("organization_roles")
    .select("id, name, is_paid, preset_key, role_permissions(permission_code)")
    .eq("organization_id", organizationId)
    .order("created_at");
  const ids = (roles ?? []).map((r) => r.id as string);
  const { data: used } = ids.length ? await supabase.from("club_profiles").select("org_role_id").in("org_role_id", ids) : { data: [] };
  const counts = new Map<string, number>();
  for (const row of used ?? []) counts.set(row.org_role_id as string, (counts.get(row.org_role_id as string) ?? 0) + 1);
  return (roles ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    isPaid: Boolean(r.is_paid),
    presetKey: (r.preset_key as string | null) ?? null,
    permissions: ((r.role_permissions as { permission_code: string }[] | null) ?? []).map((p) => p.permission_code),
    profileCount: counts.get(r.id as string) ?? 0,
  }));
});

export async function getTenantRoles(tenantId: string): Promise<OrgRole[]> {
  const org = await organizationIdForTenant(tenantId);
  return org ? getOrgRoles(org) : [];
}

export function isInstructorRole(role: OrgRole) {
  return role.permissions.includes("classes.instruct");
}

export interface PermissionInfo {
  code: string;
  module: string;
  label: string;
  ownerOnly: boolean;
}

export const getPermissionCatalog = cache(async (): Promise<PermissionInfo[]> => {
  const { data } = await createAdminSupabaseClient()
    .from("permissions")
    .select("code, module, label, owner_only")
    .order("sort_order");
  return (data ?? []).map((p) => ({ code: p.code as string, module: p.module as string, label: p.label as string, ownerOnly: Boolean(p.owner_only) }));
});
