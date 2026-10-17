import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listMemberClubs } from "@/lib/data/member-clubs";
import { staffHome } from "@/lib/auth/permissions";
import { OWNER_HOME, PERSONAL_HOME, roleHome, type AppRole } from "@/lib/auth/roles";

export interface ContextTarget {
  profileId: string;
  email: string;
  fullName: string;
  role: AppRole;
  tenantId: string;
  orgId: string;
  redirectTo: string;
}

export interface ContextEntry {
  key: string;
  kind: "org" | "member" | "staff";
  label: string;
  detail: string;
  target: ContextTarget;
}

export type ContextList = { entries: ContextEntry[]; unverified: boolean; blocked: boolean };

type TenantJoin = { name: string; is_active: boolean; organization_id: string; created_at: string } | null;

export async function listContexts(accountId: string): Promise<ContextList> {
  const supabase = createAdminSupabaseClient();
  const entries: ContextEntry[] = [];
  let unverified = false;
  let identities = 0;

  const { data: members } = await supabase
    .from("organization_users")
    .select("id, organization_id, is_active, base_role, organizations(name, organization_subscriptions(status))")
    .eq("account_id", accountId)
    .in("base_role", ["p_owner", "owner"]);

  for (const member of members ?? []) {
    identities += 1;
    if (!member.is_active) continue;
    const org = member.organizations as unknown as { name: string; organization_subscriptions: { status: string } | { status: string }[] | null } | null;
    const subscription = Array.isArray(org?.organization_subscriptions) ? org?.organization_subscriptions[0] : org?.organization_subscriptions;
    if (subscription?.status === "pending_verification") {
      unverified = true;
      continue;
    }
    const { data: profiles } = await supabase
      .from("club_profiles")
      .select("id, email, full_name, club_id, tenants:clubs(name, is_active, organization_id, created_at)")
      .eq("owner_id", member.id)
      .eq("is_active", true);
    const profile = (profiles ?? [])
      .map((p) => ({ ...p, tenant: p.tenants as unknown as TenantJoin }))
      .filter((p) => p.tenant?.is_active)
      .sort((a, b) => a.tenant!.created_at.localeCompare(b.tenant!.created_at))[0];
    if (!profile) continue;
    entries.push({
      key: `org:${member.organization_id}`,
      kind: "org",
      label: org?.name ?? "Organisasi",
      detail: member.base_role === "p_owner" ? "Pemilik utama" : "Pemilik",
      target: {
        profileId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: "owner",
        tenantId: profile.club_id,
        orgId: member.organization_id,
        redirectTo: OWNER_HOME,
      },
    });
  }

  const memberClubs = await listMemberClubs(accountId);
  if (memberClubs.length > 0) identities += 1;
  for (const club of memberClubs) {
    entries.push({
      key: `club:${club.profileId}`,
      kind: "member",
      label: club.tenantName,
      detail: "Anggota",
      target: {
        profileId: club.profileId,
        email: club.email,
        fullName: club.fullName,
        role: "member",
        tenantId: club.tenantId,
        orgId: club.orgId,
        redirectTo: roleHome("member"),
      },
    });
  }

  const { data: staff } = await supabase
    .from("club_profiles")
    .select("id, role, email, full_name, is_active, club_id, tenants:clubs(name, is_active, organization_id), organization_roles(name)")
    .eq("account_id", accountId)
    .eq("role", "staff");
  for (const profile of staff ?? []) {
    identities += 1;
    const tenant = profile.tenants as unknown as TenantJoin;
    if (!profile.is_active || !tenant?.is_active) continue;
    const { data: granted } = await supabase.rpc("profile_permissions", { p_profile: profile.id });
    const roleRow = profile.organization_roles as unknown as { name: string } | { name: string }[] | null;
    entries.push({
      key: `club:${profile.id}`,
      kind: "staff",
      label: tenant.name,
      detail: (Array.isArray(roleRow) ? roleRow[0]?.name : roleRow?.name) ?? "Staf",
      target: {
        profileId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: "staff",
        tenantId: profile.club_id,
        orgId: tenant.organization_id,
        redirectTo: roleHome("staff", staffHome(new Set((granted as string[] | null) ?? []))),
      },
    });
  }

  return { entries, unverified, blocked: identities > 0 && entries.length === 0 && !unverified };
}

export function personalTarget(account: { id: string; email: string; full_name: string }): ContextTarget {
  return {
    profileId: account.id,
    email: account.email,
    fullName: account.full_name,
    role: "personal",
    tenantId: "",
    orgId: "",
    redirectTo: PERSONAL_HOME,
  };
}

export async function resolveTarget(account: {
  id: string;
  email: string;
  full_name: string;
}): Promise<ContextTarget | "deactivated" | "unverified"> {
  const { entries, unverified, blocked } = await listContexts(account.id);
  if (entries.length === 1) return entries[0].target;
  if (entries.length > 1) return personalTarget(account);
  if (unverified) return "unverified";
  if (blocked) return (await listPendingDeletions(account.id)).length > 0 ? personalTarget(account) : "deactivated";
  return personalTarget(account);
}

export interface PendingDeletion {
  organizationId: string;
  name: string;
  purgeAfter: string;
}

export async function listPendingDeletions(accountId: string): Promise<PendingDeletion[]> {
  const { data } = await createAdminSupabaseClient()
    .from("organization_users")
    .select("organization_id, organizations!inner(name, purge_after, deletion_requested_at)")
    .eq("account_id", accountId)
    .eq("base_role", "p_owner")
    .eq("is_active", true)
    .not("organizations.deletion_requested_at", "is", null)
    .gt("organizations.purge_after", new Date().toISOString());
  return (data ?? []).map((row) => {
    const org = row.organizations as unknown as { name: string; purge_after: string } | { name: string; purge_after: string }[];
    const one = Array.isArray(org) ? org[0] : org;
    return { organizationId: row.organization_id as string, name: one.name, purgeAfter: one.purge_after };
  });
}
