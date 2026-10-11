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
import { usernameDbError, usernameSchema } from "@/lib/validations/username";

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
    .select("id, coach_id, profile_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!data) return null;
  if (session.app_role === "coach" && data.coach_id !== session.sub) return null;
  return data as { id: string; coach_id: string | null; profile_id: string | null };
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

  const tempPassword = generateTempPassword();
  const { data, error } = await createAdminSupabaseClient().rpc("activate_member_account", {
    p_member_id: member.id,
    p_email: parsed.data.email,
    p_password_hash: await hashPassword(tempPassword),
    p_username: parsed.data.username,
  });
  if (error) {
    const usernameError = usernameDbError(error.message);
    if (usernameError) return { ok: false, error: usernameError, fieldErrors: { username: usernameError } };
    if (error.code === "23505") return { ok: false, error: "Email sudah dipakai sebagai pemilik atau staf" };
    return { ok: false, error: MEMBER_ERROR_CODES.has(error.code) ? error.message : "Gagal mengaktifkan akun anggota" };
  }

  const created = (data as { out_created: boolean }[] | null)?.[0]?.out_created;
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
    .select("member_account_id")
    .eq("id", member.profile_id)
    .eq("tenant_id", session.tenant_id)
    .maybeSingle();
  if (!own?.member_account_id) return { ok: false, error: "Akun tidak ditemukan" };

  const { data: memberships } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("member_account_id", own.member_account_id);
  if ((memberships ?? []).some((m) => m.tenant_id !== session.tenant_id)) {
    return { ok: false, error: "Akun ini juga terhubung ke klub lain. Kata sandi hanya bisa diatur ulang oleh pemiliknya." };
  }

  const tempPassword = generateTempPassword();
  const { error } = await supabase
    .from("member_accounts")
    .update({
      password_hash: await hashPassword(tempPassword),
      must_change_password: true,
      failed_login_count: 0,
      locked_until: null,
    })
    .eq("id", own.member_account_id);
  if (error) return { ok: false, error: "Gagal mengatur ulang kata sandi" };

  await supabase
    .from("profiles")
    .update({ sessions_valid_after: new Date().toISOString() })
    .eq("member_account_id", own.member_account_id);

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
