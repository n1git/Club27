import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listMemberClubs } from "@/lib/data/member-clubs";

type One<T> = T | T[] | null;
const one = <T>(value: One<T>): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

export interface Certification {
  id: string;
  name: string;
  number: string | null;
  validUntil: string | null;
}

export interface OrganizationSection {
  id: string;
  name: string;
  baseRole: "p_owner" | "owner" | "staff";
  canEdit: boolean;
  clubCount: number;
  staffCount: number;
  memberCount: number;
  planName: string | null;
  billingPeriod: string | null;
  status: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
}

export interface CoachSection {
  profileId: string;
  clubName: string;
  roleName: string;
  memberCount: number;
  specialization: string | null;
  sessionRate: number | null;
  certifications: Certification[];
}

export interface MembershipSection {
  clubName: string;
  coachName: string | null;
}

export interface ProfileData {
  account: {
    email: string;
    fullName: string;
    username: string;
    phone: string | null;
    address: string | null;
  };
  organizations: OrganizationSection[];
  coaching: CoachSection[];
  memberships: MembershipSection[];
}

async function count(query: PromiseLike<{ count: number | null }>) {
  return (await query).count ?? 0;
}

async function loadOrganizations(accountId: string): Promise<OrganizationSection[]> {
  const supabase = createAdminSupabaseClient();
  const { data: rows } = await supabase
    .from("organization_users")
    .select("id, organization_id, base_role, organizations(name)")
    .eq("account_id", accountId)
    .eq("is_active", true);
  return Promise.all(
    (rows ?? []).map(async (row) => {
      const baseRole = row.base_role as OrganizationSection["baseRole"];
      const [{ data: clubs }, { data: subscription }, { data: allowed }] = await Promise.all([
        supabase.from("clubs").select("id").eq("organization_id", row.organization_id),
        supabase
          .from("organization_subscriptions")
          .select("plan_code, billing_period, status, trial_ends_at, current_period_end, subscription_plans(name)")
          .eq("organization_id", row.organization_id)
          .maybeSingle(),
        baseRole === "staff"
          ? supabase.from("organization_user_clubs").select("club_id").eq("member_id", row.id)
          : Promise.resolve({ data: null }),
      ]);
      const allClubIds = (clubs ?? []).map((c) => c.id as string);
      const scoped = allowed ? new Set(allowed.map((a) => a.club_id as string)) : null;
      const clubIds = scoped ? allClubIds.filter((id) => scoped.has(id)) : allClubIds;
      const [staffCount, memberCount] = clubIds.length
        ? await Promise.all([
            count(
              supabase
                .from("club_profiles")
                .select("id", { count: "exact", head: true })
                .in("club_id", clubIds)
                .neq("role", "member")
                .is("owner_id", null)
                .eq("is_active", true)
            ),
            count(supabase.from("club_members").select("id", { count: "exact", head: true }).in("club_id", clubIds).eq("is_active", true)),
          ])
        : [0, 0];
      return {
        id: row.organization_id as string,
        name: one(row.organizations as One<{ name: string }>)?.name ?? "-",
        baseRole,
        canEdit: baseRole === "p_owner" || baseRole === "owner",
        clubCount: clubIds.length,
        staffCount,
        memberCount,
        planName: one(subscription?.subscription_plans as One<{ name: string }>)?.name ?? subscription?.plan_code ?? null,
        billingPeriod: subscription?.billing_period ?? null,
        status: subscription?.status ?? null,
        trialEndsAt: subscription?.trial_ends_at ?? null,
        periodEnd: subscription?.current_period_end ?? null,
      };
    })
  );
}

async function loadCoaching(accountId: string): Promise<CoachSection[]> {
  const supabase = createAdminSupabaseClient();
  const { data: profiles } = await supabase
    .from("club_profiles")
    .select("id, club_id, specialization, session_rate, clubs(name), organization_roles(name)")
    .eq("account_id", accountId)
    .is("owner_id", null)
    .neq("role", "member")
    .eq("is_active", true);
  const sections = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data: granted } = await supabase.rpc("profile_permissions", { p_profile: profile.id });
      if (!((granted as string[] | null) ?? []).includes("classes.instruct")) return null;
      const [{ data: certs }, memberCount] = await Promise.all([
        supabase
          .from("coach_certifications")
          .select("id, name, number, valid_until")
          .eq("coach_id", profile.id)
          .eq("club_id", profile.club_id)
          .order("valid_until", { ascending: true, nullsFirst: false }),
        count(
          supabase.from("club_members").select("id", { count: "exact", head: true }).eq("coach_id", profile.id).eq("is_active", true)
        ),
      ]);
      return {
        profileId: profile.id as string,
        clubName: one(profile.clubs as One<{ name: string }>)?.name ?? "-",
        roleName: one(profile.organization_roles as One<{ name: string }>)?.name ?? "Staf",
        memberCount,
        specialization: profile.specialization as string | null,
        sessionRate: profile.session_rate === null ? null : Number(profile.session_rate),
        certifications: (certs ?? []).map((c) => ({ id: c.id, name: c.name, number: c.number, validUntil: c.valid_until })),
      } satisfies CoachSection;
    })
  );
  return sections.filter((s): s is CoachSection => s !== null);
}

async function loadMemberships(accountId: string): Promise<MembershipSection[]> {
  const supabase = createAdminSupabaseClient();
  const clubs = await listMemberClubs(accountId);
  if (clubs.length === 0) return [];
  const { data: members } = await supabase
    .from("club_members")
    .select("profile_id, coach:club_profiles!club_members_coach_id_fkey(full_name)")
    .in("profile_id", clubs.map((c) => c.profileId));
  const coachByProfile = new Map(
    (members ?? []).map((m) => [m.profile_id as string, one(m.coach as One<{ full_name: string }>)?.full_name ?? null])
  );
  return clubs.map((c) => ({ clubName: c.tenantName, coachName: coachByProfile.get(c.profileId) ?? null }));
}

export async function getProfileData(accountId: string): Promise<ProfileData | null> {
  const supabase = createAdminSupabaseClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("email, full_name, username, phone, address")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return null;
  const [organizations, coaching, memberships] = await Promise.all([
    loadOrganizations(accountId),
    loadCoaching(accountId),
    loadMemberships(accountId),
  ]);
  return {
    account: { email: account.email, fullName: account.full_name, username: account.username, phone: account.phone, address: account.address },
    organizations,
    coaching,
    memberships,
  };
}
