"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission, UnauthorizedError } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPendingRenewal, preparePayment, requestRenewal, requestSeatPurchase } from "@/lib/billing/renewals";
import { isMidtransConfigured } from "@/lib/payments/midtrans";
import { BILLING_PERIODS, PLAN_CODES } from "@/lib/pricing";
import { seatUsage, type SeatUsage } from "@/lib/data/platform-pricing";
import { organizationIdForTenant } from "@/lib/data/roles";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

const seatsField = z.coerce.number({ message: "Jumlah seat tidak valid" }).int("Jumlah seat tidak valid").min(1, "Jumlah seat minimal 1").max(1000, "Jumlah seat terlalu besar");

const renewalSchema = z.object({
  planCode: z.enum(PLAN_CODES, { message: "Pilih paket" }),
  billingPeriod: z.enum(BILLING_PERIODS, { message: "Pilih periode" }),
  seats: seatsField,
});

const seatPurchaseSchema = z.object({ seats: seatsField });

async function billingContext(codes: "billing.manage" | readonly ["billing.view", "billing.manage"] = "billing.manage") {
  const session = await requireActionPermission(codes, { allowBillingLocked: true });
  const organizationId = await organizationIdForTenant(session.club_id);
  if (!organizationId) throw new UnauthorizedError("Organisasi tidak ditemukan");
  const { data: member } = await createAdminSupabaseClient()
    .from("organization_users")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("account_id", session.account_id)
    .maybeSingle();
  return { session, organizationId, requestedBy: (member?.id as string | undefined) ?? null };
}

function failure(error: { code?: string; message: string }, fallback: string): ActionState {
  return { ok: false, error: error.code && (PLAN_LIMIT_CODES.has(error.code) || error.code === "22023") ? error.message : fallback };
}

async function preparePaymentFor(organizationId: string, accountId: string) {
  if (!isMidtransConfigured()) return null;
  const [renewal, { data: account }] = await Promise.all([
    getPendingRenewal(organizationId),
    createAdminSupabaseClient().from("accounts").select("full_name, email").eq("id", accountId).maybeSingle(),
  ]);
  if (!renewal || !account) return null;
  return preparePayment(renewal, { name: account.full_name as string, email: account.email as string });
}

export async function submitRenewal(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { session, organizationId, requestedBy } = await billingContext();
  const parsed = renewalSchema.safeParse({
    planCode: formData.get("planCode"),
    billingPeriod: formData.get("billingPeriod"),
    seats: formData.get("seats"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { data, error } = await requestRenewal(organizationId, requestedBy, parsed.data.planCode, parsed.data.billingPeriod, parsed.data.seats);
  if (error) return failure(error, "Gagal mengajukan perpanjangan");

  await logAudit({
    action: "subscription.renewal_request",
    targetType: "organization",
    targetId: organizationId,
    details: { renewal: data, plan: parsed.data.planCode, period: parsed.data.billingPeriod, seats: parsed.data.seats },
    tenantId: session.club_id,
    organizationId,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  const paymentUrl = await preparePaymentFor(organizationId, session.account_id);
  revalidatePath("/admin/klub/langganan");
  if (paymentUrl) return { ok: true, message: "Pengajuan tercatat. Lanjutkan pembayaran lewat tombol Bayar sekarang." };
  return { ok: true, message: "Pengajuan tercatat. Langganan aktif setelah pembayaran dikonfirmasi." };
}

export async function submitSeatPurchase(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { session, organizationId, requestedBy } = await billingContext();
  const parsed = seatPurchaseSchema.safeParse({ seats: formData.get("seats") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { data, error } = await requestSeatPurchase(organizationId, requestedBy, parsed.data.seats);
  if (error) return failure(error, "Gagal mengajukan tambah seat");

  await logAudit({
    action: "subscription.seat_request",
    targetType: "organization",
    targetId: organizationId,
    details: { renewal: data, seats: parsed.data.seats },
    tenantId: session.club_id,
    organizationId,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  const paymentUrl = await preparePaymentFor(organizationId, session.account_id);
  revalidatePath("/admin/klub/langganan");
  if (paymentUrl) return { ok: true, message: "Pengajuan tercatat. Lanjutkan pembayaran lewat tombol Bayar sekarang." };
  return { ok: true, message: "Pengajuan tercatat. Seat bertambah setelah pembayaran dikonfirmasi." };
}

export async function retryRenewalPayment(_prevState: ActionState): Promise<ActionState> {
  const { organizationId, session } = await billingContext();
  const url = await preparePaymentFor(organizationId, session.account_id);
  revalidatePath("/admin/klub/langganan");
  return url ? { ok: true, message: "Tautan pembayaran siap." } : { ok: false, error: "Tautan pembayaran belum bisa dibuat. Coba lagi beberapa saat lagi." };
}

export interface SeatPurchasePreview {
  amount: number;
  seatsAfter: number;
  unitPrice: number;
  remainingDays: number;
  periodDays: number;
}

export async function previewSeatPurchase(add: number): Promise<SeatPurchasePreview | { error: string }> {
  const { organizationId } = await billingContext(["billing.view", "billing.manage"]);
  const parsed = seatsField.safeParse(add);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Jumlah seat tidak valid" };
  const { data, error } = await createAdminSupabaseClient().rpc("seat_quote", { p_org: organizationId, p_add: parsed.data });
  const row = (data as Record<string, number | string>[] | null)?.[0];
  if (error || !row) return { error: error?.code === "22023" ? error.message : "Harga seat belum bisa dihitung" };
  return {
    amount: Number(row.amount),
    seatsAfter: Number(row.seats_after),
    unitPrice: Number(row.unit_price),
    remainingDays: Number(row.remaining_days),
    periodDays: Number(row.period_days),
  };
}

export async function previewSeatUsage(): Promise<SeatUsage | null> {
  const session = await requireActionPermission(["staff.manage", "coaches.manage", "roles.manage"]);
  const organizationId = await organizationIdForTenant(session.club_id);
  return organizationId ? seatUsage(organizationId) : null;
}
