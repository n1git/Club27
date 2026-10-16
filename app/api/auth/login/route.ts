import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { resolveTarget } from "@/lib/auth/contexts";
import { loginSchema, LOGIN_ERROR } from "@/lib/validations/auth";
import { isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { isCrossSite, readJsonBody } from "@/lib/auth/request";
import { APP_NAME } from "@/lib/config";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_ERROR = LOGIN_ERROR;
const UNVERIFIED_ERROR = "Email pendaftaran belum diverifikasi. Buka tautan verifikasi di email Anda.";
const DEACTIVATED_ERROR = `Akses klub Anda sedang dinonaktifkan. Data klub tetap tersimpan. Hubungi admin platform ${APP_NAME} untuk mengaktifkannya kembali.`;

interface LoginAccount {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: string | null;
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

  const target = await resolveTarget(account);
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
  });

  return NextResponse.json({ redirectTo: target.redirectTo });
}
