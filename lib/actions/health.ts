"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionRole } from "@/lib/auth/guard";
import { socialLimited } from "@/lib/auth/social-limit";
import { isMinorAccount, SOCIAL_MINOR_ERROR } from "@/lib/auth/social-access";
import { activeHealthConsent } from "@/lib/data/consents";
import { CONSENT_VERSION } from "@/lib/consent";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { measurementSchema } from "@/lib/validations/health";
import { type ActionState } from "./types";

const PATH = "/home/health";

function parse(formData: FormData) {
  return measurementSchema.safeParse({
    measuredOn: formData.get("measuredOn"),
    heightCm: formData.get("heightCm"),
    weightKg: formData.get("weightKg"),
  });
}

const CONSENT_NEEDED = "Setujui penyimpanan data kesehatan terlebih dahulu";

async function healthBlocked(accountId: string): Promise<ActionState | null> {
  if (await isMinorAccount(accountId)) return { ok: false, error: SOCIAL_MINOR_ERROR };
  if (!(await activeHealthConsent(accountId))) return { ok: false, error: CONSENT_NEEDED };
  return null;
}

function saveError(error: { code?: string; message: string }): ActionState {
  if (error.code === "BM001" || error.code === "BM002" || error.code === "BM003") return { ok: false, error: error.message };
  if (error.code === "23505") return { ok: false, error: "Sudah ada catatan untuk tanggal ini. Ubah catatan tersebut." };
  if (error.code === "23514") return { ok: false, error: "Tinggi 50-250 cm, berat 20-300 kg, dan minimal salah satu diisi" };
  return { ok: false, error: "Gagal menyimpan catatan kesehatan" };
}

export async function addMeasurement(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = (await socialLimited(session.account_id, "health", 60)) ?? (await healthBlocked(session.account_id));
  if (limited) return limited;
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("body_measurements").insert({
    measured_on: parsed.data.measuredOn,
    height_cm: parsed.data.heightCm ?? null,
    weight_kg: parsed.data.weightKg ?? null,
  });
  if (error) return saveError(error);
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateMeasurement(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = (await socialLimited(session.account_id, "health", 60)) ?? (await healthBlocked(session.account_id));
  if (limited) return limited;
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .update({
      measured_on: parsed.data.measuredOn,
      height_cm: parsed.data.heightCm ?? null,
      weight_kg: parsed.data.weightKg ?? null,
    })
    .eq("id", String(formData.get("measurementId")))
    .select("id");
  if (error) return saveError(error);
  if (!data?.length) return { ok: false, error: "Catatan tidak ditemukan" };
  revalidatePath(PATH);
  redirect(PATH);
}

export async function deleteMeasurement(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("body_measurements").delete().eq("id", String(formData.get("measurementId"))).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menghapus catatan kesehatan" };
  revalidatePath(PATH);
  return { ok: true };
}

export async function giveHealthConsent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  if (formData.get("agree") !== "on") return { ok: false, error: "Centang persetujuan untuk melanjutkan" };
  if (await isMinorAccount(session.account_id)) return { ok: false, error: SOCIAL_MINOR_ERROR };
  if (!(await activeHealthConsent(session.account_id))) {
    const { error } = await createAdminSupabaseClient()
      .from("consents")
      .insert({ subject_type: "account", subject_id: session.account_id, kind: "health_data", version: CONSENT_VERSION });
    if (error) return { ok: false, error: "Persetujuan gagal disimpan" };
  }
  revalidatePath(PATH);
  revalidatePath("/home/settings");
  return { ok: true };
}

export async function withdrawHealthConsent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  if (String(formData.get("confirmText") ?? "").trim() !== "HAPUS") return { ok: false, error: "Ketik HAPUS untuk mengonfirmasi" };
  if (await isKeyRateLimited(`health-withdraw:${session.account_id}`, 10, 3600, true)) return { ok: false, error: RATE_LIMIT_ERROR };
  const { error } = await createAdminSupabaseClient().rpc("withdraw_health_consent", { p_account: session.account_id });
  if (error) return { ok: false, error: "Persetujuan gagal ditarik" };
  revalidatePath(PATH);
  revalidatePath("/home/settings");
  return { ok: true };
}
