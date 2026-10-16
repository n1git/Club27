import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listMemberClubs } from "@/lib/data/member-clubs";
import { OWNER_HOME, PERSONAL_HOME, roleHome, ROLE_LABEL, type AppRole } from "@/lib/auth/roles";

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
    .from("organization_members")
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
      .from("profiles")
      .select("id, email, full_name, tenant_id, tenants(name, is_active, organization_id, created_at)")
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
        role: "admin",
        tenantId: profile.tenant_id,
        orgId: member.organization_id,
        redirectTo: OWNER_HOME,
      },
    });
  }

  const { data: memberAccount } = await supabase.from("member_accounts").select("id").eq("account_id", accountId).maybeSingle();
  if (memberAccount) {
    identities += 1;
    for (const club of await listMemberClubs(memberAccount.id)) {
      entries.push({
        key: `club:${club.profileId}`,
        kind: "member",
        label: club.tenantName,
        detail: ROLE_LABEL.member,
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
  }

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, role, email, full_name, is_active, tenant_id, tenants(name, is_active, organization_id)")
    .eq("account_id", accountId)
    .is("owner_id", null)
    .is("member_account_id", null);
  for (const profile of staff ?? []) {
    identities += 1;
    const tenant = profile.tenants as unknown as TenantJoin;
    if (!profile.is_active || !tenant?.is_active) continue;
    entries.push({
      key: `club:${profile.id}`,
      kind: "staff",
      label: tenant.name,
      detail: ROLE_LABEL[profile.role as AppRole],
      target: {
        profileId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role as AppRole,
        tenantId: profile.tenant_id,
        orgId: tenant.organization_id,
        redirectTo: roleHome(profile.role as AppRole),
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
