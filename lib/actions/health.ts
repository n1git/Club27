"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionRole } from "@/lib/auth/guard";
import { socialLimited } from "@/lib/auth/social-limit";
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

function saveError(error: { code?: string; message: string }): ActionState {
  if (error.code === "BM001" || error.code === "BM002") return { ok: false, error: error.message };
  if (error.code === "23505") return { ok: false, error: "Sudah ada catatan untuk tanggal ini. Ubah catatan tersebut." };
  if (error.code === "23514") return { ok: false, error: "Tinggi 50-250 cm, berat 20-300 kg, dan minimal salah satu diisi" };
  return { ok: false, error: "Gagal menyimpan catatan kesehatan" };
}

export async function addMeasurement(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "health", 60);
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
  const limited = await socialLimited(session.account_id, "health", 60);
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
