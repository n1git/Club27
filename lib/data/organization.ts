import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface OrganizationTenant {
  id: string;
  name: string;
  isActive: boolean;
  members: number;
  coaches: number;
}

export interface OrganizationOverview {
  name: string;
  clubLimit: number | null;
  tenants: OrganizationTenant[];
}

export async function getOrganizationOverview(organizationId: string, ownerId: string): Promise<OrganizationOverview | null> {
  const supabase = createAdminSupabaseClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, organization_members:organization_users!inner(id), organization_subscriptions(club_limit_override, subscription_plans(club_limit))")
    .eq("id", organizationId)
    .eq("organization_members.id", ownerId)
    .maybeSingle();
  if (!org) return null;
  const sub = org.organization_subscriptions as unknown as {
    club_limit_override: number | null;
    subscription_plans: { club_limit: number | null } | null;
  } | null;

  const { data: tenants } = await supabase
    .from("clubs")
    .select("id, name, is_active, created_at")
    .eq("organization_id", organizationId)
    .order("created_at");
  const ids = (tenants ?? []).map((t) => t.id as string);

  const [{ data: members }, { data: coaches }] = await Promise.all([
    supabase.from("club_members").select("club_id").in("club_id", ids).eq("is_active", true),
    supabase.from("instructors").select("club_id").in("club_id", ids).eq("is_active", true),
  ]);
  const count = (rows: { club_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.club_id === id).length;

  return {
    name: org.name as string,
    clubLimit: sub?.club_limit_override ?? sub?.subscription_plans?.club_limit ?? null,
    tenants: (tenants ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      isActive: t.is_active as boolean,
      members: count(members, t.id as string),
      coaches: count(coaches, t.id as string),
    })),
  };
}

export interface SwitchableTenant {
  id: string;
  name: string;
}

export async function getSwitchableTenants(ownerId: string): Promise<SwitchableTenant[]> {
  const { data } = await createAdminSupabaseClient()
    .from("club_profiles")
    .select("club_id, tenants:clubs!inner(name, is_active, created_at)")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .eq("tenants.is_active", true);
  return (data ?? [])
    .map((p) => ({ id: p.club_id as string, ...(p.tenants as unknown as { name: string; created_at: string }) }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ id, name }) => ({ id, name }));
}
