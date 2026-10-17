import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface MemberClub {
  profileId: string;
  tenantId: string;
  tenantName: string;
  orgId: string;
  email: string;
  fullName: string;
}

type TenantJoin = { name: string; is_active: boolean; organization_id: string; created_at: string } | null;

export async function listMemberClubs(accountId: string): Promise<MemberClub[]> {
  const supabase = createAdminSupabaseClient();
  const { data: profiles } = await supabase
    .from("club_profiles")
    .select("id, email, full_name, club_id, tenants:clubs(name, is_active, organization_id, created_at)")
    .eq("account_id", accountId)
    .eq("role", "member")
    .eq("is_active", true);
  const ids = (profiles ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const { data: members } = await supabase.from("club_members").select("profile_id").in("profile_id", ids).eq("is_active", true);
  const activeProfiles = new Set((members ?? []).map((m) => m.profile_id as string));

  return (profiles ?? [])
    .map((p) => ({ p, tenant: p.tenants as unknown as TenantJoin }))
    .filter(({ p, tenant }) => activeProfiles.has(p.id as string) && tenant?.is_active)
    .sort((a, b) => a.tenant!.created_at.localeCompare(b.tenant!.created_at))
    .map(({ p, tenant }) => ({
      profileId: p.id as string,
      tenantId: p.club_id as string,
      tenantName: tenant!.name,
      orgId: tenant!.organization_id,
      email: p.email as string,
      fullName: p.full_name as string,
    }));
}

export async function listClubsForProfile(profileId: string): Promise<MemberClub[]> {
  const { data } = await createAdminSupabaseClient()
    .from("club_profiles")
    .select("account_id, role")
    .eq("id", profileId)
    .maybeSingle();
  return data?.role === "member" && data.account_id ? listMemberClubs(data.account_id as string) : [];
}
