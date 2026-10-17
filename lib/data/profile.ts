import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listMemberClubs } from "@/lib/data/member-clubs";
import { listContexts } from "@/lib/auth/contexts";

type One<T> = T | T[] | null;
const one = <T>(value: One<T>): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

export interface Certification {
  id: string;
  name: string;
  number: string | null;
  validUntil: string | null;
}

export type ProfileData =
  | { kind: "personal"; email: string; fullName: string; username: string; contexts: { key: string; label: string; detail: string }[] }
  | {
      kind: "owner";
      email: string;
      fullName: string;
      username: string;
      organizationName: string;
      planName: string | null;
      billingPeriod: string | null;
      status: string | null;
      trialEndsAt: string | null;
      periodEnd: string | null;
      clubs: { id: string; name: string; isActive: boolean }[];
    }
  | {
      kind: "staff";
      email: string;
      fullName: string;
      username: string;
      phone: string | null;
      roleName: string;
      clubName: string;
      coach: { specialization: string | null; sessionRate: number | null; certifications: Certification[] } | null;
    }
  | {
      kind: "member";
      email: string;
      fullName: string;
      username: string;
      clubs: { tenantId: string; name: string; coachName: string | null }[];
    };

export async function getProfileData(ids: {
  profileId: string;
  accountId: string;
  ownerId: string | null;
  isMember: boolean;
  personal?: boolean;
}): Promise<ProfileData | null> {
  const supabase = createAdminSupabaseClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("email, full_name, username")
    .eq("id", ids.accountId)
    .maybeSingle();
  if (!account) return null;
  if (ids.personal) {
    const { entries } = await listContexts(ids.accountId);
    return {
      kind: "personal",
      email: account.email,
      fullName: account.full_name,
      username: account.username,
      contexts: entries.map((e) => ({ key: e.key, label: e.label, detail: e.detail })),
    };
  }

  if (ids.ownerId) {
    const { data: owner } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(name)")
      .eq("id", ids.ownerId)
      .maybeSingle();
    if (!owner) return null;
    const [{ data: subscription }, { data: tenants }] = await Promise.all([
      supabase
        .from("organization_subscriptions")
        .select("plan_code, billing_period, status, trial_ends_at, current_period_end, subscription_plans(name)")
        .eq("organization_id", owner.organization_id)
        .maybeSingle(),
      supabase.from("tenants").select("id, name, is_active").eq("organization_id", owner.organization_id).order("created_at"),
    ]);
    return {
      kind: "owner",
      email: account.email,
      fullName: account.full_name,
      username: account.username,
      organizationName: one(owner.organizations as One<{ name: string }>)?.name ?? "-",
      planName: one(subscription?.subscription_plans as One<{ name: string }>)?.name ?? subscription?.plan_code ?? null,
      billingPeriod: subscription?.billing_period ?? null,
      status: subscription?.status ?? null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      periodEnd: subscription?.current_period_end ?? null,
      clubs: (tenants ?? []).map((t) => ({ id: t.id, name: t.name, isActive: t.is_active })),
    };
  }

  if (ids.isMember) {
    const clubs = await listMemberClubs(ids.accountId);
    const { data: members } = clubs.length
      ? await supabase
          .from("members")
          .select("profile_id, coach:profiles!members_coach_id_fkey(full_name)")
          .in("profile_id", clubs.map((c) => c.profileId))
      : { data: [] };
    const coachByProfile = new Map(
      (members ?? []).map((m) => [m.profile_id as string, one(m.coach as One<{ full_name: string }>)?.full_name ?? null])
    );
    return {
      kind: "member",
      email: account.email,
      fullName: account.full_name,
      username: account.username,
      clubs: clubs.map((c) => ({ tenantId: c.tenantId, name: c.tenantName, coachName: coachByProfile.get(c.profileId) ?? null })),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone, role, specialization, session_rate, tenant_id, tenants(name), organization_roles(name)")
    .eq("id", ids.profileId)
    .is("owner_id", null)
    .neq("role", "member")
    .maybeSingle();
  if (!profile) return null;

  let coach: Extract<ProfileData, { kind: "staff" }>["coach"] = null;
  const { data: granted } = await supabase.rpc("profile_permissions", { p_profile: profile.id });
  if (((granted as string[] | null) ?? []).includes("classes.instruct")) {
    const { data: certs } = await supabase
      .from("coach_certifications")
      .select("id, name, number, valid_until")
      .eq("coach_id", profile.id)
      .eq("tenant_id", profile.tenant_id)
      .order("valid_until", { ascending: true, nullsFirst: false });
    coach = {
      specialization: profile.specialization,
      sessionRate: profile.session_rate === null ? null : Number(profile.session_rate),
      certifications: (certs ?? []).map((c) => ({ id: c.id, name: c.name, number: c.number, validUntil: c.valid_until })),
    };
  }

  return {
    kind: "staff",
    email: account.email,
    fullName: account.full_name,
    username: account.username,
    phone: profile.phone,
    roleName: one(profile.organization_roles as One<{ name: string }>)?.name ?? "Staf",
    clubName: one(profile.tenants as One<{ name: string }>)?.name ?? "-",
    coach,
  };
}
