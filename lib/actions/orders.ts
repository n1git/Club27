"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { commerceErrorMessage } from "@/lib/commerce";
import { orderPayloadSchema, paymentSchema } from "@/lib/validations/commerce";
import { type ActionState } from "./types";

function refresh() {
  revalidatePath("/admin/kasir");
  revalidatePath("/admin/pesanan");
  revalidatePath("/admin/produk");
  revalidatePath("/admin/booking");
  revalidatePath("/admin/cash-ledger");
  revalidatePath("/member/pesanan");
}

export async function createOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole(["admin", "receptionist"]);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Data tidak valid" };
  }
  const parsed = orderPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const v = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_order_once", {
    p_request_id: v.requestId,
    p_member_id: v.memberId ?? null,
    p_customer_name: v.customerName ?? null,
    p_items: v.items.map((i) =>
      i.kind === "product"
        ? { kind: "product", product_id: i.productId, qty: i.qty }
        : { kind: "booking", booking_id: i.bookingId }
    ),
    p_payments: v.payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference ?? null })),
  });
  if (error) return { ok: false, error: commerceErrorMessage(error, "Gagal menyimpan pesanan") };
  refresh();
  return { ok: true, message: "Pesanan tersimpan", orderId: data as string };
}

export async function addOrderPayment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole(["admin", "receptionist"]);
  const id = z.string().uuid().safeParse(formData.get("orderId"));
  const requestId = z.string().uuid().safeParse(formData.get("requestId"));
  const parsed = paymentSchema.safeParse({
    method: formData.get("method"),
    amount: formData.get("amount"),
    reference: formData.get("reference") || undefined,
  });
  if (!id.success || !requestId.success || !parsed.success) {
    return { ok: false, error: parsed.success ? "Data tidak valid" : (parsed.error.issues[0]?.message ?? "Data tidak valid") };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_order_payment_once", {
    p_request_id: requestId.data,
    p_order_id: id.data,
    p_method: parsed.data.method,
    p_amount: parsed.data.amount,
    p_reference: parsed.data.reference ?? null,
  });
  if (error) return { ok: false, error: commerceErrorMessage(error, "Gagal mencatat pembayaran") };
  refresh();
  return { ok: true, message: data === "paid" ? "Pembayaran tercatat, pesanan lunas" : "Pembayaran tercatat" };
}

export async function voidOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole(["admin", "receptionist"]);
  const id = z.string().uuid().safeParse(formData.get("orderId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const reason = z.string().trim().min(5, "Tulis alasan pembatalan, minimal 5 karakter").max(500, "Alasan terlalu panjang").safeParse(formData.get("reason") ?? "");
  if (!reason.success) return { ok: false, error: reason.error.issues[0]?.message ?? "Alasan tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("void_order", { p_order_id: id.data, p_reason: reason.data });
  if (error) return { ok: false, error: commerceErrorMessage(error, "Gagal membatalkan pesanan") };
  refresh();
  return { ok: true, message: "Pesanan dibatalkan" };
}
