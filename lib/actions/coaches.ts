"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTenantAccount } from "@/lib/accounts/create";
import { certificationSchema, coachSchema, coachUpdateSchema } from "@/lib/validations/coaches";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

export async function createCoach(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireActionRole("admin");

  const parsed = coachSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const result = await createTenantAccount(session.tenant_id, "coach", parsed.data, "Gagal membuat akun pelatih");
  if (!result.ok) return result;

  revalidatePath("/admin/coaches");
  return { ...result, message: "Pelatih berhasil ditambahkan" };
}

export async function updateCoach(
  coachId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionRole("admin");

  const parsed = coachUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
    specialization: formData.get("specialization") || undefined,
    sessionRate: formData.get("sessionRate") || undefined,
    isHeadCoach: formData.get("isHeadCoach") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
      specialization: parsed.data.specialization ?? null,
      session_rate: parsed.data.sessionRate ?? null,
      is_head_coach: parsed.data.isHeadCoach,
    })
    .eq("id", coachId)
    .eq("role", "coach");

  if (error) {
    return { ok: false, error: "Gagal memperbarui data pelatih" };
  }

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${coachId}`);
  return { ok: true };
}

export async function toggleCoachActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("admin");
  const coachId = String(formData.get("coachId"));
  const isActive = formData.get("isActive") === "true";

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", coachId)
    .eq("role", "coach")
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: error && PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal memperbarui status pelatih" };
  }

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${coachId}`);
  return { ok: true, message: isActive ? "Pelatih diaktifkan kembali" : "Pelatih dinonaktifkan" };
}

export async function addCertification(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("admin");
  const parsed = certificationSchema.safeParse({
    coachId: formData.get("coachId"),
    name: formData.get("name"),
    number: formData.get("number") || undefined,
    validUntil: formData.get("validUntil") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("coach_certifications").insert({
    coach_id: parsed.data.coachId,
    name: parsed.data.name,
    number: parsed.data.number ?? null,
    valid_until: parsed.data.validUntil ?? null,
  });
  if (error) return { ok: false, error: "Gagal menyimpan sertifikasi" };

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${parsed.data.coachId}`);
  return { ok: true, message: "Sertifikasi ditambahkan" };
}

export async function deleteCertification(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("admin");
  const certificationId = String(formData.get("certificationId"));
  const coachId = String(formData.get("coachId"));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("coach_certifications").delete().eq("id", certificationId).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menghapus sertifikasi" };

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${coachId}`);
  return { ok: true, message: "Sertifikasi dihapus" };
}
