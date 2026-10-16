"use server";

import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { getSession, createSession } from "@/lib/auth/session";
import { checkSession, sessionEndedPath } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";
import { roleHome } from "@/lib/auth/roles";

export interface ChangePasswordState {
  error?: string;
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? undefined,
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Kata sandi tidak valid" };
  }

  const supabase = createAdminSupabaseClient();
  const { data: current } = await supabase
    .from("accounts")
    .select("password_hash")
    .eq("id", session.account_id)
    .maybeSingle();
  if (!current?.password_hash) return { error: "Akun tidak ditemukan" };

  if (!check.mustChangePassword) {
    if (await isKeyRateLimited(`change-password:${session.account_id}`, 10, 900)) return { error: RATE_LIMIT_ERROR };
    if (!parsed.data.currentPassword || !(await verifyPassword(parsed.data.currentPassword, current.password_hash))) {
      return { error: "Kata sandi saat ini salah" };
    }
  }
  if (await verifyPassword(parsed.data.newPassword, current.password_hash)) {
    return { error: "Kata sandi baru harus berbeda dari kata sandi saat ini" };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const validAfter = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();

  await supabase
    .from("accounts")
    .update({ password_hash: passwordHash, must_change_password: false, sessions_valid_after: validAfter })
    .eq("id", session.account_id);

  await logAudit({
    action: "password.change",
    targetType: "account",
    targetId: session.account_id,
    tenantId: session.tenant_id || undefined,
    actorId: session.sub,
    actorRole: session.app_role,
  });

  await createSession({
    id: session.sub,
    accountId: session.account_id,
    email: session.email,
    fullName: session.full_name,
    role: session.app_role,
    tenantId: session.tenant_id,
    orgId: session.org_id,
    clubPending: session.club_pending,
  });

  redirect(roleHome(session.app_role));
}
