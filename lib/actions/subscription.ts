"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { requireOwnerAction } from "@/lib/auth/owner";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPendingRenewal, preparePayment, requestRenewal } from "@/lib/billing/renewals";
import { isMidtransConfigured } from "@/lib/payments/midtrans";
import { BILLING_PERIODS, PLAN_CODES } from "@/lib/pricing";
import { internalUserCostChange, type InternalUserCostChange } from "@/lib/data/platform-pricing";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

const renewalSchema = z.object({
  planCode: z.enum(PLAN_CODES, { message: "Pilih paket" }),
  billingPeriod: z.enum(BILLING_PERIODS, { message: "Pilih periode" }),
});

export async function submitRenewal(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwnerAction({ allowBillingLocked: true });
  const parsed = renewalSchema.safeParse({
    planCode: formData.get("planCode"),
    billingPeriod: formData.get("billingPeriod"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { data, error } = await requestRenewal(owner.organizationId, owner.ownerId, parsed.data.planCode, parsed.data.billingPeriod);
  if (error) {
    return { ok: false, error: PLAN_LIMIT_CODES.has(error.code) || error.code === "22023" ? error.message : "Gagal mengajukan perpanjangan" };
  }

  await logAudit({
    action: "subscription.renewal_request",
    targetType: "organization",
    targetId: owner.organizationId,
    details: { renewal: data, plan: parsed.data.planCode, period: parsed.data.billingPeriod },
    tenantId: owner.tenantId,
    organizationId: owner.organizationId,
    actorId: owner.profileId,
    actorRole: "admin",
  });
  const paymentUrl = await preparePaymentFor(owner.organizationId, owner.ownerId);
  revalidatePath("/admin/klub/langganan");
  if (paymentUrl) return { ok: true, message: "Pengajuan tercatat. Lanjutkan pembayaran lewat tombol Bayar sekarang." };
  return { ok: true, message: "Pengajuan tercatat. Langganan aktif setelah pembayaran dikonfirmasi." };
}

async function preparePaymentFor(organizationId: string, ownerId: string) {
  if (!isMidtransConfigured()) return null;
  const [renewal, { data: owner }] = await Promise.all([
    getPendingRenewal(organizationId),
    createAdminSupabaseClient().from("organization_members").select("full_name, email").eq("id", ownerId).maybeSingle(),
  ]);
  if (!renewal || !owner) return null;
  return preparePayment(renewal, { name: owner.full_name as string, email: owner.email as string });
}

export async function retryRenewalPayment(_prevState: ActionState): Promise<ActionState> {
  const owner = await requireOwnerAction({ allowBillingLocked: true });
  const url = await preparePaymentFor(owner.organizationId, owner.ownerId);
  revalidatePath("/admin/klub/langganan");
  return url ? { ok: true, message: "Tautan pembayaran siap." } : { ok: false, error: "Tautan pembayaran belum bisa dibuat. Coba lagi beberapa saat lagi." };
}

export async function previewInternalUserCost(): Promise<InternalUserCostChange | null> {
  const session = await requireActionRole("admin");
  const { data: tenant } = await createAdminSupabaseClient()
    .from("tenants")
    .select("organization_id")
    .eq("id", session.tenant_id)
    .maybeSingle();
  if (!tenant) return null;
  return internalUserCostChange(tenant.organization_id as string);
}
