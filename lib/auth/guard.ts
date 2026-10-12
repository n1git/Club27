import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { SessionClaims } from "./jwt";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { roleHome, type AppRole } from "./roles";
import { BILLING_OPEN_PATHS, isBillingLocked, type BillingState } from "@/lib/billing/access";

export class UnauthorizedError extends Error {}

export type SessionEndReason = "deactivated" | "revoked" | "suspended" | "expired";


interface ValidProfile {
  id: string;
  fullName: string;
  isHeadCoach: boolean;
  ownerId: string | null;
  memberAccountId: string | null;
}

export type SessionCheck =
  | { ok: true; profile: ValidProfile; mustChangePassword: boolean; billingLocked: boolean }
  | { ok: false; reason: SessionEndReason };

type One<T> = T | T[] | null;
const one = <T>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

export async function checkSession(session: SessionClaims): Promise<SessionCheck> {
  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, tenant_id, role, is_active, must_change_password, full_name, sessions_valid_after, owner_id, member_account_id, is_head_coach, tenants(is_active, organizations(organization_subscriptions(status, trial_ends_at, current_period_end))), org_owners(is_active), member_accounts(is_active, must_change_password)"
    )
    .eq("id", session.sub)
    .maybeSingle();

  if (!profile || !profile.is_active) return { ok: false, reason: "deactivated" };
  if (profile.tenant_id !== session.tenant_id || profile.role !== session.app_role) {
    return { ok: false, reason: "revoked" };
  }
  if (
    profile.sessions_valid_after &&
    (session.iat ?? 0) < Math.floor(Date.parse(profile.sessions_valid_after) / 1000)
  ) {
    return { ok: false, reason: "revoked" };
  }
  const tenant = one(
    profile.tenants as One<{ is_active: boolean; organizations: One<{ organization_subscriptions: One<BillingState> }> }>
  );
  if (!tenant?.is_active) return { ok: false, reason: "suspended" };
  const billingLocked = isBillingLocked(one(one(tenant.organizations)?.organization_subscriptions ?? null));
  if (billingLocked && !profile.owner_id) return { ok: false, reason: "expired" };

  if (profile.owner_id && !one(profile.org_owners as One<{ is_active: boolean }>)?.is_active) {
    return { ok: false, reason: "deactivated" };
  }

  let accountMustChange = false;
  if (profile.member_account_id) {
    const account = one(profile.member_accounts as One<{ is_active: boolean; must_change_password: boolean }>);
    const { data: member } = await admin.from("members").select("is_active").eq("profile_id", profile.id).maybeSingle();
    if (!account?.is_active || !member?.is_active) return { ok: false, reason: "deactivated" };
    accountMustChange = account.must_change_password;
  }

  return {
    ok: true,
    billingLocked,
    mustChangePassword: Boolean(profile.must_change_password) || accountMustChange,
    profile: {
      id: profile.id,
      fullName: profile.full_name as string,
      isHeadCoach: Boolean(profile.is_head_coach),
      ownerId: profile.owner_id,
      memberAccountId: profile.member_account_id,
    },
  };
}

export function sessionEndedPath(reason: SessionEndReason) {
  return `/api/auth/session-ended?reason=${reason}`;
}

export async function requireValidSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));
  return { session, ...check };
}

export async function requireRole(role: AppRole | readonly AppRole[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  const roles: readonly AppRole[] = typeof role === "string" ? [role] : role;
  if (!roles.includes(session.app_role)) redirect(roleHome(session.app_role));

  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));
  if (check.mustChangePassword) redirect("/change-password");
  if (check.billingLocked) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (!BILLING_OPEN_PATHS.some((open) => path === open || path.startsWith(`${open}/`))) {
      redirect(BILLING_OPEN_PATHS[0]);
    }
  }

  return {
    id: session.sub,
    email: session.email,
    role: session.app_role,
    tenantId: session.tenant_id,
    orgId: session.org_id,
    fullName: check.profile.fullName,
    isHeadCoach: check.profile.isHeadCoach,
    clubPending: Boolean(session.club_pending),
    billingLocked: check.billingLocked,
  };
}

export async function requireMemberClub() {
  const user = await requireRole("member");
  if (user.clubPending) redirect("/member/klub");
  return user;
}

export async function requireActionRole(
  role: AppRole | readonly AppRole[],
  options: { allowBillingLocked?: boolean } = {}
) {
  const session = await getSession();
  if (!session) throw new UnauthorizedError("Anda harus login");
  const roles: readonly AppRole[] = typeof role === "string" ? [role] : role;
  if (!roles.includes(session.app_role)) {
    throw new UnauthorizedError("Anda tidak memiliki akses untuk aksi ini");
  }
  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));
  if (check.mustChangePassword) redirect("/change-password");
  if (check.billingLocked && !options.allowBillingLocked) redirect(BILLING_OPEN_PATHS[0]);
  return session;
}
