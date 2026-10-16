"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission, requireActionRole } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { bookingErrorMessage } from "@/lib/booking";
import { isoSchema } from "@/lib/validations/booking";
import { type ActionState } from "./types";

function revalidateBooking() {
  revalidatePath("/admin/booking");
  revalidatePath("/member/booking");
  revalidatePath("/admin/schedule");
}

const idSchema = z.string().uuid("Data tidak valid");

export async function bookResource(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resource_bookings.manage");
  const kind = formData.get("who");
  const parsed = z
    .object({
      resourceId: idSchema,
      start: isoSchema,
      end: isoSchema,
      memberId: z.string().uuid("Pilih anggota").optional(),
      guestName: z.string().trim().min(2, "Nama tamu minimal 2 karakter").max(80).optional(),
      guestPhone: z.string().trim().max(30).optional(),
    })
    .safeParse({
      resourceId: formData.get("resourceId"),
      start: formData.get("start"),
      end: formData.get("end"),
      memberId: kind === "member" ? formData.get("memberId") || undefined : undefined,
      guestName: kind === "guest" ? formData.get("guestName") || undefined : undefined,
      guestPhone: kind === "guest" ? formData.get("guestPhone") || undefined : undefined,
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const v = parsed.data;
  if (!v.memberId && !v.guestName) {
    return { ok: false, error: kind === "member" ? "Pilih anggota" : "Isi nama tamu" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("book_resource", {
    p_resource_id: v.resourceId,
    p_start: v.start,
    p_end: v.end,
    p_member_id: v.memberId ?? null,
    p_guest_name: v.guestName ?? null,
    p_guest_phone: v.guestPhone ?? null,
  });
  if (error) return { ok: false, error: bookingErrorMessage(error, "Gagal membuat booking") };
  revalidateBooking();
  return { ok: true, message: "Booking dibuat" };
}

export async function bookResourceAsMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("member");
  const parsed = z
    .object({ resourceId: idSchema, start: isoSchema, end: isoSchema })
    .safeParse({ resourceId: formData.get("resourceId"), start: formData.get("start"), end: formData.get("end") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("book_resource_as_member", {
    p_resource_id: parsed.data.resourceId,
    p_start: parsed.data.start,
    p_end: parsed.data.end,
  });
  if (error) return { ok: false, error: bookingErrorMessage(error, "Gagal membuat booking") };
  revalidateBooking();
  return { ok: true, message: "Booking berhasil" };
}

export async function cancelBooking(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resource_bookings.manage", { orMember: true });
  const id = idSchema.safeParse(formData.get("bookingId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: id.data });
  if (error) return { ok: false, error: bookingErrorMessage(error, "Gagal membatalkan booking") };
  revalidateBooking();
  return { ok: true, message: "Booking dibatalkan" };
}

export async function setBookingStatus(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("resource_bookings.manage");
  const parsed = z
    .object({ bookingId: idSchema, status: z.enum(["completed", "no_show"]) })
    .safeParse({ bookingId: formData.get("bookingId"), status: formData.get("status") });
  if (!parsed.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_booking_status", {
    p_booking_id: parsed.data.bookingId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: bookingErrorMessage(error, "Gagal mengubah status") };
  revalidateBooking();
  return { ok: true, message: "Status diperbarui" };
}
