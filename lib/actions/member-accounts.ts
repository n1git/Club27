"use server";

import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { isModuleReady } from "@/lib/modules";
import { type ActionState } from "./types";
import { usernameSchema } from "@/lib/validations/username";
import { createAccount, discardUnusedAccount, findAccountByEmail } from "@/lib/accounts/account";

const MODULE_ERROR: ActionState = { ok: false, error: "Portal anggota belum tersedia" };
const MEMBER_ERROR_CODES = new Set(["MP001", "MP002", "MP003", "MP004"]);

const activateSchema = z.object({
  memberId: z.string().uuid("Anggota tidak valid"),
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang"),
  username: usernameSchema,
});

const resetSchema = z.object({ memberId: z.string().uuid("Anggota tidak valid") });

async function visibleMember(memberId: string, session: { app_role: string; sub: string }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("members")
    .select("id, coach_id, profile_id, full_name")
    .eq("id", memberId)
    .maybeSingle();
  if (!data) return null;
  if (session.app_role === "coach" && data.coach_id !== session.sub) return null;
  return data as { id: string; coach_id: string | null; profile_id: string | null; full_name: string };
}

function revalidateMember(memberId: string) {
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/coach");
}

export async function activateMemberAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole(["admin", "coach"]);
  if (!(await isModuleReady("member_portal"))) return MODULE_ERROR;

  const parsed = activateSchema.safeParse({
    memberId: formData.get("memberId"),
    email: formData.get("email"),
    username: formData.get("username"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const member = await visibleMember(parsed.data.memberId, session);
  if (!member) return { ok: false, error: "Anggota tidak ditemukan" };

  const supabase = createAdminSupabaseClient();
  const existing = await findAccountByEmail(parsed.data.email);
  if (existing && !existing.is_active) return { ok: false, error: "Akun dengan email ini dinonaktifkan" };
  if (existing && !existing.email_verified_at) {
    const { count } = await supabase
      .from("member_accounts")
      .select("id", { count: "exact", head: true })
      .eq("account_id", existing.id);
    if (!count) {
      return { ok: false, error: "Email ini sudah punya akun yang belum terverifikasi. Gunakan email lain atau minta pemilik email masuk ke akunnya." };
    }
  }

  const tempPassword = generateTempPassword();
  let accountId = existing?.id;
  if (!accountId) {
    const account = await createAccount({
      email: parsed.data.email,
      username: parsed.data.username,
      fullName: member.full_name,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    });
    if (!account.ok) {
      if (account.field === "username") return { ok: false, error: account.error, fieldErrors: { username: account.error } };
      return { ok: false, error: account.error };
    }
    accountId = account.id;
  }

  const { error } = await supabase.rpc("activate_member_account", { p_member_id: member.id, p_account_id: accountId });
  if (error) {
    if (!existing) await discardUnusedAccount(accountId);
    if (error.code === "23505") return { ok: false, error: "Email sudah dipakai sebagai pemilik atau staf" };
    return { ok: false, error: MEMBER_ERROR_CODES.has(error.code) ? error.message : "Gagal mengaktifkan akun anggota" };
  }

  const created = !existing;
  await logAudit({
    action: "member_account.activate",
    targetType: "member",
    targetId: member.id,
    details: { created: Boolean(created) },
    tenantId: session.tenant_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidateMember(member.id);
  return created
    ? { ok: true, message: "Akun anggota dibuat", tempPassword }
    : { ok: true, message: "Akun sudah ada, anggota login dengan kata sandinya" };
}

export async function resetMemberPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole(["admin", "coach"]);
  if (!(await isModuleReady("member_portal"))) return MODULE_ERROR;

  const parsed = resetSchema.safeParse({ memberId: formData.get("memberId") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const member = await visibleMember(parsed.data.memberId, session);
  if (!member?.profile_id) return { ok: false, error: "Anggota belum punya akun" };

  const supabase = createAdminSupabaseClient();
  const { data: own } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", member.profile_id)
    .eq("tenant_id", session.tenant_id)
    .maybeSingle();
  if (!own?.account_id) return { ok: false, error: "Akun tidak ditemukan" };

  const [{ count: otherProfiles }, { count: owners }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_id", own.account_id)
      .neq("id", member.profile_id),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("account_id", own.account_id),
  ]);
  if (otherProfiles || owners) {
    return { ok: false, error: "Akun ini juga terhubung ke klub lain. Kata sandi hanya bisa diatur ulang oleh pemiliknya." };
  }

  const tempPassword = generateTempPassword();
  const { error } = await supabase
    .from("accounts")
    .update({
      password_hash: await hashPassword(tempPassword),
      must_change_password: true,
      failed_login_count: 0,
      locked_until: null,
      sessions_valid_after: new Date().toISOString(),
    })
    .eq("id", own.account_id);
  if (error) return { ok: false, error: "Gagal mengatur ulang kata sandi" };

  await logAudit({
    action: "password.reset",
    targetType: "member",
    targetId: member.id,
    tenantId: session.tenant_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidateMember(member.id);
  return { ok: true, message: "Kata sandi sementara baru dibuat", tempPassword };
}
