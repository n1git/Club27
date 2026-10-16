import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { roleHome, OWNER_HOME, PERSONAL_HOME, type AppRole } from "@/lib/auth/roles";
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

interface LoginAccount {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: string | null;
}

async function resolveTarget(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  account: LoginAccount
): Promise<SessionTarget | "deactivated" | "unverified"> {
  const { data: owner } = await supabase
    .from("org_owners")
    .select("id, organization_id, is_active")
    .eq("account_id", account.id)
    .maybeSingle();
  if (owner) {
    if (!owner.is_active) return "deactivated";
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
    const profile = (profiles ?? [])
      .map((p) => ({ ...p, tenant: p.tenants as unknown as TenantJoin }))
      .filter((p) => p.tenant?.is_active)
      .sort((a, b) => a.tenant!.created_at.localeCompare(b.tenant!.created_at))[0];
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
  }

  const { data: memberAccount } = await supabase
    .from("member_accounts")
    .select("id")
    .eq("account_id", account.id)
    .maybeSingle();
  if (memberAccount) {
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
  }

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, role, email, full_name, is_active, tenant_id, tenants(is_active, organization_id, created_at)")
    .eq("account_id", account.id)
    .is("owner_id", null)
    .is("member_account_id", null)
    .maybeSingle();
  if (staff) {
    const tenant = staff.tenants as unknown as TenantJoin;
    if (!staff.is_active || !tenant?.is_active) return "deactivated";
    return {
      profileId: staff.id,
      email: staff.email,
      fullName: staff.full_name,
      role: staff.role as AppRole,
      tenantId: staff.tenant_id,
      orgId: tenant.organization_id,
      redirectTo: roleHome(staff.role as AppRole),
    };
  }

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

  const { data: found } = await supabase
    .from("accounts")
    .select("id, email, full_name, is_active, password_hash, failed_login_count, locked_until")
    .eq(identifier.field, identifier.value)
    .maybeSingle();
  const account: LoginAccount | null = found?.is_active ? (found as LoginAccount) : null;

  const locked = Boolean(account?.locked_until && new Date(account.locked_until) > new Date());
  const valid = await verifyPasswordOrDummy(password, account && !locked ? account.password_hash : null);
  if (!account || locked || !valid) {
    if (!account || locked) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    const nextCount = account.failed_login_count + 1;
    await supabase
      .from("accounts")
      .update({
        failed_login_count: nextCount,
        locked_until:
          nextCount >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
            : null,
      })
      .eq("id", account.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const target = await resolveTarget(supabase, account);
  if (target === "deactivated") {
    return NextResponse.json({ error: DEACTIVATED_ERROR }, { status: 403 });
  }
  if (target === "unverified") {
    return NextResponse.json({ error: UNVERIFIED_ERROR }, { status: 403 });
  }

  await supabase
    .from("accounts")
    .update({
      failed_login_count: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  await createSession({
    id: target.profileId,
    accountId: account.id,
    email: target.email,
    fullName: target.fullName,
    role: target.role,
    tenantId: target.tenantId,
    orgId: target.orgId,
    clubPending: target.clubPending,
  });

  return NextResponse.json({ redirectTo: target.redirectTo });
}
