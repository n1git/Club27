"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isModuleReady } from "@/lib/modules";
import { bookingErrorMessage } from "@/lib/booking";
import { hoursSchema, resourceSchema } from "@/lib/validations/booking";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

const MODULE_ERROR: ActionState = { ok: false, error: "Fasilitas & Booking tidak aktif untuk klub ini" };

function revalidateResources() {
  revalidatePath("/admin/fasilitas");
  revalidatePath("/admin/booking");
  revalidatePath("/admin/onboarding");
  revalidatePath("/member/booking");
}

function fromForm(formData: FormData) {
  return {
    locationId: formData.get("locationId"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    capacity: formData.get("capacity"),
    slotMinutes: formData.get("slotMinutes"),
    pricePerSlot: formData.get("pricePerSlot") || 0,
    advanceDays: formData.get("advanceDays"),
    cancelHours: formData.get("cancelHours"),
    opens: formData.get("opens"),
    closes: formData.get("closes"),
  };
}

export async function createResource(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resources.manage");
  if (!(await isModuleReady("resource_booking"))) return MODULE_ERROR;
  const parsed = resourceSchema.safeParse(fromForm(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const v = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_resource", {
    p_location_id: v.locationId,
    p_name: v.name,
    p_kind: v.kind,
    p_capacity: v.capacity,
    p_slot_minutes: v.slotMinutes,
    p_price_per_slot: v.pricePerSlot,
    p_advance_days: v.advanceDays,
    p_cancel_hours: v.cancelHours,
    p_opens: v.opens,
    p_closes: v.closes,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Nama sudah dipakai di lokasi ini" };
    return {
      ok: false,
      error: PLAN_LIMIT_CODES.has(error.code) ? error.message : bookingErrorMessage(error, "Gagal menyimpan"),
    };
  }
  revalidateResources();
  return { ok: true, message: "Ditambahkan" };
}

export async function createResourcesBulk(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resources.manage");
  if (!(await isModuleReady("resource_booking"))) return MODULE_ERROR;
  const count = z.coerce.number().int().min(1, "Jumlah minimal 1").max(50, "Jumlah maksimal 50").safeParse(formData.get("count"));
  if (!count.success) return { ok: false, error: count.error.issues[0]?.message ?? "Data tidak valid" };
  const pattern = String(formData.get("namePattern") ?? "").trim();
  if (!pattern.includes("{n}")) return { ok: false, error: "Pola nama harus memuat {n}" };

  const supabase = await createServerSupabaseClient();
  for (let i = 1; i <= count.data; i++) {
    const parsed = resourceSchema.safeParse({ ...fromForm(formData), name: pattern.replaceAll("{n}", String(i)) });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    const v = parsed.data;
    const { error } = await supabase.rpc("create_resource", {
      p_location_id: v.locationId,
      p_name: v.name,
      p_kind: v.kind,
      p_capacity: v.capacity,
      p_slot_minutes: v.slotMinutes,
      p_price_per_slot: v.pricePerSlot,
      p_advance_days: v.advanceDays,
      p_cancel_hours: v.cancelHours,
      p_opens: v.opens,
      p_closes: v.closes,
    });
    if (error) {
      revalidateResources();
      return {
        ok: false,
        error:
          error.code === "23505"
            ? `${v.name} sudah ada. ${i - 1} fasilitas sebelumnya sudah tersimpan.`
            : bookingErrorMessage(error, "Gagal menyimpan"),
      };
    }
  }
  revalidateResources();
  return { ok: true, message: `${count.data} ditambahkan` };
}

export async function updateResource(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resources.manage");
  if (!(await isModuleReady("resource_booking"))) return MODULE_ERROR;
  const id = z.string().uuid().safeParse(formData.get("resourceId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const parsed = resourceSchema.safeParse({ ...fromForm(formData), opens: "00:00", closes: "23:59" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const v = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("resources")
    .update({
      name: v.name,
      kind: v.kind,
      capacity: v.capacity,
      slot_minutes: v.slotMinutes,
      price_per_slot: v.pricePerSlot,
      advance_days: v.advanceDays,
      cancel_hours: v.cancelHours,
    })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: error?.code === "23505" ? "Nama sudah dipakai di lokasi ini" : "Gagal menyimpan" };
  }
  revalidateResources();
  return { ok: true, message: "Disimpan" };
}

export async function setResourceActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resources.manage");
  const parsed = z
    .object({ resourceId: z.string().uuid(), isActive: z.enum(["true", "false"]) })
    .safeParse({ resourceId: formData.get("resourceId"), isActive: formData.get("isActive") });
  if (!parsed.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("resources")
    .update({ is_active: parsed.data.isActive === "true" })
    .eq("id", parsed.data.resourceId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal mengubah status" };
  revalidateResources();
  return { ok: true, message: parsed.data.isActive === "true" ? "Diaktifkan" : "Dinonaktifkan" };
}

export async function setResourceHours(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resources.manage");
  if (!(await isModuleReady("resource_booking"))) return MODULE_ERROR;
  const id = z.string().uuid().safeParse(formData.get("resourceId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };

  const rows: { weekday: number; opens: string; closes: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (formData.get(`open-${d}`) !== "on") continue;
    rows.push({ weekday: d, opens: String(formData.get(`opens-${d}`) ?? ""), closes: String(formData.get(`closes-${d}`) ?? "") });
  }
  const parsed = hoursSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_resource_hours", { p_resource_id: id.data, p_hours: parsed.data });
  if (error) return { ok: false, error: bookingErrorMessage(error, "Gagal menyimpan jam buka") };
  revalidateResources();
  return { ok: true, message: "Jam buka disimpan" };
}
