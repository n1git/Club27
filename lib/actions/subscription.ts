"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActionPermission, UnauthorizedError } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPendingRenewal, preparePayment, requestRenewal, requestSeatPurchase } from "@/lib/billing/renewals";
import { isMidtransConfigured } from "@/lib/payments/midtrans";
import { BILLING_PERIODS, PLAN_CODES } from "@/lib/pricing";
import { planMinSeats, seatUsage, type SeatUsage } from "@/lib/data/platform-pricing";
import { organizationIdForTenant } from "@/lib/data/roles";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";
import { addressField } from "@/lib/validations/limits";

const seatsField = (min: number) =>
  z.coerce.number({ message: "Jumlah seat tidak valid" }).int("Jumlah seat tidak valid").min(min, `Minimal pembelian ${min} seat`).max(1000, "Jumlah seat terlalu besar");

const renewalSchema = (minSeats: number) =>
  z.object({
    planCode: z.enum(PLAN_CODES, { message: "Pilih paket" }),
    billingPeriod: z.enum(BILLING_PERIODS, { message: "Pilih periode" }),
    seats: seatsField(minSeats),
  });

const seatPurchaseSchema = z.object({ seats: seatsField(1) });

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
  const minSeats = (await planMinSeats(String(formData.get("planCode")))) ?? 1;
  const parsed = renewalSchema(minSeats).safeParse({
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
  revalidatePath("/admin/plan");
  if (paymentUrl) redirect(paymentUrl);
  return { ok: true, message: "Tagihan dibuat. Langganan aktif setelah pembayaran dikonfirmasi." };
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
  revalidatePath("/admin/plan");
  if (paymentUrl) redirect(paymentUrl);
  return { ok: true, message: "Tagihan dibuat. Seat bertambah setelah pembayaran dikonfirmasi." };
}

export async function retryRenewalPayment(_prevState: ActionState): Promise<ActionState> {
  const { organizationId, session } = await billingContext();
  const url = await preparePaymentFor(organizationId, session.account_id);
  if (url) redirect(url);
  return { ok: false, error: "Pembayaran belum bisa dibuka. Coba lagi beberapa saat lagi." };
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
  const parsed = seatsField(1).safeParse(add);
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

const billingProfileSchema = z.object({
  billingAddress: addressField,
  billingEmail: z.union([z.literal(""), z.string().trim().email("Email tidak valid").max(200, "Email terlalu panjang")]),
});

export async function updateBillingProfile(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { organizationId } = await billingContext();
  const parsed = billingProfileSchema.safeParse({
    billingAddress: formData.get("billingAddress") ?? "",
    billingEmail: formData.get("billingEmail") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const { error } = await createAdminSupabaseClient()
    .from("organizations")
    .update({ billing_address: parsed.data.billingAddress || null, billing_email: parsed.data.billingEmail || null })
    .eq("id", organizationId);
  if (error) return { ok: false, error: "Data penagihan gagal disimpan" };
  revalidatePath("/admin/plan");
  return { ok: true, message: "Data penagihan disimpan. Berlaku untuk tagihan berikutnya." };
}
