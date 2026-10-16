"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isModuleReady } from "@/lib/modules";
import { CHECKIN_ERROR_CODES } from "@/lib/checkin";
import { type ActionState } from "./types";

const MODULE_ERROR: ActionState = { ok: false, error: "Check-in belum tersedia di klub ini" };

const nameSchema = z.string().trim().min(2, "Nama titik minimal 2 karakter").max(60, "Nama titik terlalu panjang");
const idSchema = z.string().uuid("Data tidak valid");

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Data tidak valid";
}

export async function createCheckinPoint(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("checkin.manage");
  if (!(await isModuleReady("checkin"))) return MODULE_ERROR;

  const parsed = z
    .object({
      name: nameSchema,
      locationId: z
        .string()
        .optional()
        .transform((v) => (v ? v : undefined))
        .pipe(idSchema.optional()),
    })
    .safeParse({ name: formData.get("name"), locationId: formData.get("locationId") || undefined });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("checkin_points")
    .insert({ name: parsed.data.name, location_id: parsed.data.locationId ?? null });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Nama titik sudah dipakai" : "Gagal menambah titik check-in" };
  }

  revalidatePath("/admin/checkin");
  return { ok: true, message: "Titik check-in ditambahkan" };
}

export async function renameCheckinPoint(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("checkin.manage");
  const parsed = z
    .object({ pointId: idSchema, name: nameSchema })
    .safeParse({ pointId: formData.get("pointId"), name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("checkin_points")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.pointId)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: error?.code === "23505" ? "Nama titik sudah dipakai" : "Gagal mengubah nama titik" };
  }

  revalidatePath("/admin/checkin");
  return { ok: true, message: "Nama titik diperbarui" };
}

export async function setCheckinPointActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("checkin.manage");
  const parsed = z
    .object({ pointId: idSchema, isActive: z.enum(["true", "false"]) })
    .safeParse({ pointId: formData.get("pointId"), isActive: formData.get("isActive") });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("checkin_points")
    .update({ is_active: parsed.data.isActive === "true" })
    .eq("id", parsed.data.pointId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal memperbarui titik" };

  revalidatePath("/admin/checkin");
  return { ok: true, message: parsed.data.isActive === "true" ? "Titik diaktifkan" : "Titik dinonaktifkan" };
}

export async function fetchCheckinToken(pointId: string): Promise<{ token?: string; error?: string }> {
  await requireActionPermission("checkin.manage");
  if (!idSchema.safeParse(pointId).success) return { error: "Titik tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("checkin_token", { p_point_id: pointId });
  if (error || typeof data !== "string") return { error: "Gagal mengambil kode" };
  return { token: data };
}

export async function manualCheckin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission(["checkin.record_all", "checkin.record_assigned"]);
  if (!(await isModuleReady("checkin"))) return MODULE_ERROR;

  const parsed = z
    .object({
      memberId: idSchema,
      pointId: z
        .string()
        .optional()
        .transform((v) => (v ? v : undefined))
        .pipe(idSchema.optional()),
    })
    .safeParse({ memberId: formData.get("memberId"), pointId: formData.get("pointId") || undefined });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("manual_checkin", {
    p_member_id: parsed.data.memberId,
    p_point_id: parsed.data.pointId ?? null,
  });
  if (error) {
    return { ok: false, error: CHECKIN_ERROR_CODES.has(error.code) ? error.message : "Gagal mencatat check-in" };
  }

  const already = (data as { out_already: boolean }[] | null)?.[0]?.out_already;
  revalidatePath("/admin/checkin");
  revalidatePath("/coach");
  return { ok: true, message: already ? "Anggota sudah check-in dalam 2 jam terakhir" : "Check-in tercatat" };
}
