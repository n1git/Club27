"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission, requireActionRole } from "@/lib/auth/guard";
import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";
import { decideJoinSchema, joinRequestSchema } from "@/lib/validations/club-join";
import { uuidField } from "@/lib/validations/social";
import { PRIVACY_VERSION } from "@/lib/privacy";

const KNOWN = new Set(["JN001", "JN002", "JN003", "JN004", "JN005", "JN006", "JN007", "JN008", "MP001", "MP002", "MP003", "MP004"]);

export async function requestClubJoin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const parsed = joinRequestSchema.safeParse({
    code: formData.get("code"),
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message") || undefined,
    acceptPrivacy: formData.get("acceptPrivacy") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  if (await isKeyRateLimited(`club-join:${session.account_id}`, 10, 3600, true)) return { ok: false, error: RATE_LIMIT_ERROR };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("request_club_join", {
    p_code: parsed.data.code,
    p_full_name: parsed.data.fullName,
    p_dob: parsed.data.dateOfBirth,
    p_phone: parsed.data.phone ?? null,
    p_message: parsed.data.message ?? null,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error) return { ok: false, error: KNOWN.has(error.code) ? error.message : "Gagal mengirim permintaan" };
  revalidatePath("/akun", "layout");
  return { ok: true, message: "Permintaan dikirim. Klub akan meninjaunya." };
}

export async function cancelClubJoin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("requestId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_club_join", { p_id: id.data });
  if (error) return { ok: false, error: KNOWN.has(error.code) ? error.message : "Gagal membatalkan permintaan" };
  revalidatePath("/akun", "layout");
  return { ok: true };
}

export async function decideClubJoin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("members.create");
  const parsed = decideJoinSchema.safeParse({
    requestId: formData.get("requestId"),
    approve: formData.get("approve"),
    coachId: formData.get("coachId") || undefined,
    memberId: formData.get("memberId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const { error } = await createAdminSupabaseClient().rpc("decide_club_join", {
    p_id: parsed.data.requestId,
    p_club: session.club_id,
    p_actor: session.sub,
    p_approve: parsed.data.approve === "1",
    p_coach: parsed.data.coachId ?? null,
    p_member: parsed.data.memberId ?? null,
  });
  if (error) {
    if (PLAN_LIMIT_CODES.has(error.code)) return { ok: false, error: error.message };
    if (error.code === "23505") return { ok: false, error: "Email pemohon sudah dipakai sebagai pemilik atau staf" };
    return { ok: false, error: KNOWN.has(error.code) ? error.message : "Gagal memproses permintaan" };
  }
  revalidatePath("/admin/permintaan-gabung");
  revalidatePath("/admin/members");
  return { ok: true, message: parsed.data.approve === "1" ? "Anggota ditambahkan" : "Permintaan ditolak" };
}
