"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type ActionState } from "./types";

export async function markAttendance(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission(["bookings.manage_all", "bookings.manage_assigned"]);
  const bookingId = String(formData.get("bookingId"));
  const classId = String(formData.get("classId"));
  const isAttended = formData.get("isAttended") === "true";

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("class_bookings")
    .update({
      is_attended: isAttended,
      attended_at: isAttended ? new Date().toISOString() : null,
    })
    .eq("id", bookingId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menyimpan kehadiran" };

  revalidatePath(`/coach/attendance/${classId}`);
  revalidatePath(`/admin/schedule/${classId}`);
  return { ok: true, message: isAttended ? "Ditandai hadir" : "Kehadiran dibatalkan" };
}

export async function updateBookingNotes(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("bookings.manage_assigned");
  const bookingId = String(formData.get("bookingId"));
  const classId = String(formData.get("classId"));
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 2000) return { ok: false, error: "Catatan maksimal 2.000 karakter" };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("class_bookings")
    .update({ notes: notes || null })
    .eq("id", bookingId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menyimpan catatan" };

  revalidatePath(`/coach/attendance/${classId}`);
  return { ok: true, message: "Catatan disimpan" };
}
