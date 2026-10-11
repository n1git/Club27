import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { roleHome, OWNER_HOME, type AppRole } from "@/lib/auth/roles";
import { loginSchema, LOGIN_ERROR } from "@/lib/validations/auth";
import { isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { isCrossSite, readJsonBody } from "@/lib/auth/request";
import { APP_NAME } from "@/lib/config";
import { listMemberClubs } from "@/lib/data/member-clubs";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_ERROR = LOGIN_ERROR;
const UNVERIFIED_ERROR = "Email pendaftaran belum diverifikasi. Buka tautan verifikasi di email Anda.";
const DEACTIVATED_ERROR = `Akses klub Anda sedang dinonaktifkan. Data klub tetap tersimpan. Hubungi admin platform ${APP_NAME} untuk mengaktifkannya kembali.`;

interface LoginAccount {
  table: "org_owners" | "member_accounts" | "auth_credentials";
  key: "id" | "profile_id";
  id: string;
  passwordHash: string;
  failedCount: number;
  lockedUntil: string | null;
}

interface SessionTarget {
  profileId: string;
  email: string;
  fullName: string;
  role: AppRole;
  tenantId: string;
  orgId: string;
  redirectTo: string;
  clubPending?: boolean;
}

type TenantJoin = { is_active: boolean; organization_id: string; created_at: string } | null;

export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  }
  if (await isRateLimited(request, "login", 20, 600, true)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const body = await readJsonBody(request);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { identifier, password } = parsed.data;

  const supabase = createAdminSupabaseClient();

  let account: LoginAccount | null = null;
  let resolveTarget: () => Promise<SessionTarget | "deactivated" | "unverified"> = async () => "deactivated";

  const { data: owner } = await supabase
    .from("org_owners")
    .select("id, organization_id, is_active, password_hash, failed_login_count, locked_until")
    .eq(identifier.field, identifier.value)
    .maybeSingle();

  const { data: memberAccount } = owner
    ? { data: null }
    : await supabase
        .from("member_accounts")
        .select("id, is_active, password_hash, failed_login_count, locked_until")
        .eq(identifier.field, identifier.value)
        .maybeSingle();

  if (owner?.is_active) {
    account = {
      table: "org_owners",
      key: "id",
      id: owner.id,
      passwordHash: owner.password_hash,
      failedCount: owner.failed_login_count,
      lockedUntil: owner.locked_until,
    };
    resolveTarget = async () => {
      const { data: subscription } = await supabase
        .from("organization_subscriptions")
        .select("status")
        .eq("organization_id", owner.organization_id)
        .maybeSingle();
      if (subscription?.status === "pending_verification") return "unverified";
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, tenant_id, tenants(is_active, organization_id, created_at)")
        .eq("owner_id", owner.id)
        .eq("is_active", true);
      const rows = (profiles ?? [])
        .map((p) => ({ ...p, tenant: p.tenants as unknown as TenantJoin }))
        .filter((p) => p.tenant?.is_active)
        .sort((a, b) => a.tenant!.created_at.localeCompare(b.tenant!.created_at));
      const profile = rows[0];
      if (!profile) return "deactivated";
      return {
        profileId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: "admin",
        tenantId: profile.tenant_id,
        orgId: owner.organization_id,
        redirectTo: OWNER_HOME,
      };
    };
  } else if (memberAccount?.is_active) {
    account = {
      table: "member_accounts",
      key: "id",
      id: memberAccount.id,
      passwordHash: memberAccount.password_hash,
      failedCount: memberAccount.failed_login_count,
      lockedUntil: memberAccount.locked_until,
    };
    resolveTarget = async () => {
      const clubs = await listMemberClubs(memberAccount.id);
      const club = clubs[0];
      if (!club) return "deactivated";
      return {
        profileId: club.profileId,
        email: club.email,
        fullName: club.fullName,
        role: "member",
        tenantId: club.tenantId,
        orgId: club.orgId,
        redirectTo: clubs.length > 1 ? "/member/klub" : roleHome("member"),
        clubPending: clubs.length > 1,
      };
    };
  } else if (!owner && !memberAccount) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, email, full_name, is_active, tenant_id, tenants(is_active, organization_id, created_at)")
      .eq(identifier.field, identifier.value)
      .is("owner_id", null)
      .maybeSingle();

    const { data: credentials } = profile?.is_active
      ? await supabase
          .from("auth_credentials")
          .select("password_hash, failed_login_count, locked_until")
          .eq("profile_id", profile.id)
          .maybeSingle()
      : { data: null };

    if (profile && credentials) account = {
      table: "auth_credentials",
      key: "profile_id",
      id: profile.id,
      passwordHash: credentials.password_hash,
      failedCount: credentials.failed_login_count,
      lockedUntil: credentials.locked_until,
    };
    if (profile) resolveTarget = async () => {
      const tenant = profile.tenants as unknown as TenantJoin;
      if (!tenant?.is_active) return "deactivated";
      return {
        profileId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role as AppRole,
        tenantId: profile.tenant_id,
        orgId: tenant.organization_id,
        redirectTo: roleHome(profile.role as AppRole),
      };
    };
  }

  const locked = Boolean(account?.lockedUntil && new Date(account.lockedUntil) > new Date());
  const valid = await verifyPasswordOrDummy(password, account && !locked ? account.passwordHash : null);
  if (!account || locked || !valid) {
    if (!account || locked) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    const nextCount = account.failedCount + 1;
    await supabase
      .from(account.table)
      .update({
        failed_login_count: nextCount,
        locked_until:
          nextCount >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
            : null,
      })
      .eq(account.key, account.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const target = await resolveTarget();
  if (target === "deactivated") {
    return NextResponse.json({ error: DEACTIVATED_ERROR }, { status: 403 });
  }
  if (target === "unverified") {
    return NextResponse.json({ error: UNVERIFIED_ERROR }, { status: 403 });
  }

  await supabase
    .from(account.table)
    .update({
      failed_login_count: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq(account.key, account.id);

  await createSession({
    id: target.profileId,
    email: target.email,
    fullName: target.fullName,
    role: target.role,
    tenantId: target.tenantId,
    orgId: target.orgId,
    clubPending: target.clubPending,
  });

  return NextResponse.json({ redirectTo: target.redirectTo });
}
