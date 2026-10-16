"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTenantAccount } from "@/lib/accounts/create";
import { setStaffProfileActive, setStaffProfileRole } from "@/lib/accounts/staff-seat";
import { getTenantRoles, isInstructorRole } from "@/lib/data/roles";
import { certificationSchema, coachSchema, coachUpdateSchema } from "@/lib/validations/coaches";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

export async function createCoach(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireActionPermission("coaches.manage");

  const parsed = coachSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const roles = (await getTenantRoles(session.tenant_id)).filter(isInstructorRole);
  const defaultRole = roles.find((r) => r.presetKey === "pelatih") ?? roles[0];
  if (!defaultRole) return { ok: false, error: "Belum ada peran pelatih. Buat peran dengan izin menjadi pelatih terlebih dulu." };
  const result = await createTenantAccount(session.tenant_id, defaultRole.id, parsed.data, "Gagal membuat akun pelatih");
  if (!result.ok) return result;

  revalidatePath("/admin/coaches");
  return { ...result, message: "Pelatih berhasil ditambahkan" };
}

export async function updateCoach(
  coachId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireActionPermission("coaches.manage");

  const parsed = coachUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
    specialization: formData.get("specialization") || undefined,
    sessionRate: formData.get("sessionRate") || undefined,
    roleId: formData.get("roleId"),
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
    })
    .eq("id", coachId)
    .eq("role", "staff");

  if (error) {
    return { ok: false, error: "Gagal memperbarui data pelatih" };
  }
  const roleFailure = await setStaffProfileRole(session.tenant_id, coachId, parsed.data.roleId, true);
  if (roleFailure) return { ok: false, error: roleFailure };

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${coachId}`);
  return { ok: true };
}

export async function toggleCoachActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("coaches.manage");
  const coachId = String(formData.get("coachId"));
  const isActive = formData.get("isActive") === "true";

  const failure = await setStaffProfileActive(session.tenant_id, coachId, isActive);
  if (failure) return { ok: false, error: failure };

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${coachId}`);
  return { ok: true, message: isActive ? "Pelatih diaktifkan kembali" : "Pelatih dinonaktifkan" };
}

export async function addCertification(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("coaches.manage");
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
  await requireActionPermission("coaches.manage");
  const certificationId = String(formData.get("certificationId"));
  const coachId = String(formData.get("coachId"));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("coach_certifications").delete().eq("id", certificationId).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menghapus sertifikasi" };

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${coachId}`);
  return { ok: true, message: "Sertifikasi dihapus" };
}
