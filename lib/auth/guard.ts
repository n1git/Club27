import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { SessionClaims } from "./jwt";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { cache } from "react";
import { roleHome, type AppRole } from "./roles";
import { adminPathAllowed, hasAny, staffHome, type PermissionCode, type PermissionSet } from "./permissions";
import { BILLING_OPEN_PATHS, isBillingLocked, type BillingState } from "@/lib/billing/access";

export class UnauthorizedError extends Error {}

export type SessionEndReason = "deactivated" | "revoked" | "suspended" | "expired";


interface ValidProfile {
  id: string;
  accountId: string;
  fullName: string;
  ownerId: string | null;
  memberAccountId: string | null;
}

export type SessionCheck =
  | { ok: true; profile: ValidProfile; mustChangePassword: boolean; billingLocked: boolean }
  | { ok: false; reason: SessionEndReason };

type One<T> = T | T[] | null;
const one = <T>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

type AccountRow = { id: string; is_active: boolean; must_change_password: boolean; sessions_valid_after: string | null };

function accountRevoked(account: AccountRow | null, session: SessionClaims): SessionEndReason | null {
  if (!account || !account.is_active) return "deactivated";
  if (account.id !== session.account_id) return "revoked";
  if (account.sessions_valid_after && (session.iat ?? 0) < Math.floor(Date.parse(account.sessions_valid_after) / 1000)) {
    return "revoked";
  }
  return null;
}

export async function checkSession(session: SessionClaims): Promise<SessionCheck> {
  const admin = createAdminSupabaseClient();
  if (!session.account_id || !session.ctx) return { ok: false, reason: "revoked" };

  if (session.app_role === "personal") {
    if (session.ctx !== "personal" || session.sub !== session.account_id) return { ok: false, reason: "revoked" };
    const { data: account } = await admin
      .from("accounts")
      .select("id, is_active, must_change_password, sessions_valid_after, full_name")
      .eq("id", session.sub)
      .maybeSingle();
    const reason = accountRevoked(account, session);
    if (reason) return { ok: false, reason };
    return {
      ok: true,
      billingLocked: false,
      mustChangePassword: Boolean(account!.must_change_password),
      profile: {
        id: account!.id,
        accountId: account!.id,
        fullName: account!.full_name as string,
        ownerId: null,
        memberAccountId: null,
      },
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, tenant_id, role, is_active, full_name, sessions_valid_after, owner_id, member_account_id, account_id, tenants(is_active, organizations(organization_subscriptions(status, trial_ends_at, current_period_end))), organization_members(is_active), member_accounts(is_active), accounts(id, is_active, must_change_password, sessions_valid_after)"
    )
    .eq("id", session.sub)
    .maybeSingle();

  if (!profile || !profile.is_active) return { ok: false, reason: "deactivated" };
  if (profile.tenant_id !== session.tenant_id || profile.role !== session.app_role) {
    return { ok: false, reason: "revoked" };
  }
  const account = one(profile.accounts as One<AccountRow>);
  const accountReason = accountRevoked(account, session);
  if (accountReason) return { ok: false, reason: accountReason };
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

  if (profile.owner_id && !one(profile.organization_members as One<{ is_active: boolean }>)?.is_active) {
    return { ok: false, reason: "deactivated" };
  }

  if (profile.member_account_id) {
    const memberAccount = one(profile.member_accounts as One<{ is_active: boolean }>);
    const { data: member } = await admin.from("members").select("is_active").eq("profile_id", profile.id).maybeSingle();
    if (!memberAccount?.is_active || !member?.is_active) return { ok: false, reason: "deactivated" };
  }

  return {
    ok: true,
    billingLocked,
    mustChangePassword: Boolean(account!.must_change_password),
    profile: {
      id: profile.id,
      accountId: account!.id,
      fullName: profile.full_name as string,
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

const EMPTY_PERMISSIONS: PermissionSet = new Set();

export const loadPermissions = cache(async (profileId: string): Promise<PermissionSet> => {
  const { data } = await createAdminSupabaseClient().rpc("profile_permissions", { p_profile: profileId });
  return new Set((data as string[] | null) ?? []);
});

export const loadRoleLabel = cache(async (profileId: string, role: AppRole): Promise<string> => {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("profiles")
    .select("organization_roles(name), organization_members(base_role)")
    .eq("id", profileId)
    .maybeSingle();
  if (role === "owner") {
    const member = data?.organization_members as unknown as { base_role: string } | { base_role: string }[] | null;
    const base = Array.isArray(member) ? member[0]?.base_role : member?.base_role;
    return base === "p_owner" ? "Pemilik utama" : "Pemilik";
  }
  const roleRow = data?.organization_roles as unknown as { name: string } | { name: string }[] | null;
  return (Array.isArray(roleRow) ? roleRow[0]?.name : roleRow?.name) ?? "Staf";
});

export async function permissionsFor(session: SessionClaims): Promise<PermissionSet> {
  return session.app_role === "owner" || session.app_role === "staff" ? loadPermissions(session.sub) : EMPTY_PERMISSIONS;
}

export async function currentPermissions(): Promise<PermissionSet> {
  const session = await getSession();
  return session ? permissionsFor(session) : EMPTY_PERMISSIONS;
}

export async function homeFor(session: SessionClaims): Promise<string> {
  return roleHome(session.app_role, staffHome(await permissionsFor(session)));
}

export async function requireRole(role: AppRole | readonly AppRole[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  const roles: readonly AppRole[] = typeof role === "string" ? [role] : role;
  if (!roles.includes(session.app_role)) redirect(await homeFor(session));

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
    accountId: check.profile.accountId,
    clubPending: Boolean(session.club_pending),
    billingLocked: check.billingLocked,
    permissions: await permissionsFor(session),
  };
}

export async function requirePermission(codes: PermissionCode | readonly PermissionCode[]) {
  const user = await requireRole(["owner", "staff"]);
  if (!hasAny(user.permissions, codes)) {
    redirect(user.role === "staff" ? staffHome(user.permissions) : roleHome(user.role));
  }
  return user;
}

export async function requireAdminArea() {
  const user = await requireRole(["owner", "staff"]);
  const path = (await headers()).get("x-pathname") ?? "/admin";
  if (!adminPathAllowed(user.role === "owner", user.permissions, path)) {
    redirect(user.role === "owner" ? roleHome("owner") : staffHome(user.permissions));
  }
  return user;
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

export async function requireActionPermission(
  codes: PermissionCode | readonly PermissionCode[],
  options: { allowBillingLocked?: boolean; orMember?: boolean } = {}
) {
  const session = await requireActionRole(options.orMember ? ["owner", "staff", "member"] : ["owner", "staff"], options);
  if (session.app_role === "member") return { ...session, permissions: EMPTY_PERMISSIONS };
  const permissions = await permissionsFor(session);
  if (!hasAny(permissions, codes)) throw new UnauthorizedError("Anda tidak memiliki akses untuk aksi ini");
  return { ...session, permissions };
}
