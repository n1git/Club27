"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { memberSchema } from "@/lib/validations/members";
import { isMinor, PRIVACY_VERSION } from "@/lib/privacy";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

export interface DuplicateMemberMatch {
  id: string;
  full_name: string;
  date_of_birth: string;
  contact_name: string | null;
  similarity: number;
}

export async function searchDuplicateMembers(
  fullName: string,
  dateOfBirth: string
): Promise<DuplicateMemberMatch[]> {
  await requireActionPermission("members.create");
  if (!fullName.trim()) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_similar_members", {
    p_full_name: fullName,
    p_date_of_birth: dateOfBirth || null,
  });
  if (error || !data) return [];
  return data as DuplicateMemberMatch[];
}

function parseMember(formData: FormData) {
  return memberSchema.safeParse({
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    coachId: formData.get("coachId"),
    contactName: formData.get("contactName") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    notes: formData.get("notes") || undefined,
    address: formData.get("address") || undefined,
    preferredLocationId: formData.get("preferredLocationId") || undefined,
  });
}

function memberColumns(input: NonNullable<ReturnType<typeof parseMember>["data"]>) {
  return {
    full_name: input.fullName,
    date_of_birth: input.dateOfBirth,
    coach_id: input.coachId,
    contact_name: input.contactName || null,
    contact_phone: input.contactPhone || null,
    notes: input.notes ?? null,
    address: input.address ?? null,
    preferred_location_id: input.preferredLocationId ?? null,
  };
}

export async function createMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("members.create");

  const parsed = parseMember(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  if (formData.get("consentMemberData") !== "on") {
    return { ok: false, error: "Centang persetujuan pencatatan data anggota" };
  }
  const minor = isMinor(parsed.data.dateOfBirth);
  const guardianName = String(formData.get("guardianName") ?? "").trim();
  if (minor && (formData.get("consentGuardian") !== "on" || guardianName.length < 2 || guardianName.length > 200)) {
    return { ok: false, error: "Anggota di bawah 18 tahun: isi nama orang tua/wali dan centang persetujuannya" };
  }

  const supabase = await createServerSupabaseClient();
  const { data: created, error } = await supabase.from("members").insert(memberColumns(parsed.data)).select("id").single();

  if (error || !created) {
    return {
      ok: false,
      error: error && PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal menyimpan data anggota",
    };
  }

  const consent = { tenant_id: session.tenant_id, subject_type: "member", subject_id: created.id, version: PRIVACY_VERSION };
  const consents = [
    { ...consent, kind: "member_data", guardian_name: null },
    ...(minor ? [{ ...consent, kind: "guardian", guardian_name: guardianName }] : []),
  ];
  const { error: consentError } = await supabase.from("consents").insert(consents);
  if (consentError) {
    return { ok: false, error: "Anggota tersimpan, tetapi persetujuan gagal dicatat. Hubungi admin." };
  }

  revalidatePath("/admin/members");
  return { ok: true, message: "Anggota berhasil ditambahkan" };
}

export async function updateMember(
  memberId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionPermission("members.update_all");

  const parsed = parseMember(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("members").update(memberColumns(parsed.data)).eq("id", memberId);

  if (error) {
    return { ok: false, error: "Gagal memperbarui data anggota" };
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function toggleMemberActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("members.change_status");
  const memberId = String(formData.get("memberId"));
  const isActive = formData.get("isActive") === "true";

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("members").update({ is_active: isActive }).eq("id", memberId);
  if (error) {
    return {
      ok: false,
      error: PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal memperbarui status anggota",
    };
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true, message: isActive ? "Anggota diaktifkan kembali" : "Anggota dinonaktifkan" };
}

export async function reassignMemberCoach(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("members.reassign_coach");
  const memberId = String(formData.get("memberId"));
  const coachId = String(formData.get("coachId"));
  if (!coachId) return { ok: false, error: "Pilih pelatih" };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("members").update({ coach_id: coachId }).eq("id", memberId).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal memindahkan anggota" };

  revalidatePath("/coach", "layout");
  return { ok: true, message: "Pelatih anggota diperbarui" };
}
