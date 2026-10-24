"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  ownerActiveSchema,
  activateOrganizationSchema,
  organizationStatusSchema,
  extendTrialSchema,
  clubLimitOverrideSchema,
  planEditSchema,
} from "@/lib/validations/superadmin";
import { getJakartaDateString } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { confirmRenewal } from "@/lib/billing/renewals";
import { z } from "zod";
import { type ActionState } from "./types";

export async function toggleOwnerActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let superadmin: Awaited<ReturnType<typeof requireSuperadminAction>>;
  try {
    superadmin = await requireSuperadminAction();
  } catch {
    return { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };
  }

  const parsed = ownerActiveSchema.safeParse({
    ownerId: formData.get("ownerId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { data: owner, error } = await createAdminSupabaseClient()
    .from("organization_users")
    .update({ is_active: parsed.data.isActive === "true" })
    .eq("id", parsed.data.ownerId)
    .select("organization_id")
    .maybeSingle();
  if (error) return { ok: false, error: "Gagal memperbarui status pemilik" };
  await platformAudit(superadmin, parsed.data.isActive === "true" ? "owner.activate" : "owner.deactivate", "owner", parsed.data.ownerId, owner?.organization_id ?? null, {});

  revalidatePath("/superadmin");
  return { ok: true, message: parsed.data.isActive === "true" ? "Pemilik diaktifkan" : "Pemilik dinonaktifkan" };
}

async function platformAudit(
  superadmin: { id: string; email: string },
  action: string,
  targetType: string,
  targetId: string | null,
  organizationId: string | null,
  details: Record<string, unknown>
) {
  await logAudit({ action, targetType, targetId, organizationId, details, actorId: superadmin.id, actorRole: "superadmin", actorLabel: superadmin.email });
}

const SESSION_ENDED: ActionState = { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };

async function superadminOrNull() {
  try {
    return await requireSuperadminAction();
  } catch {
    return null;
  }
}

export async function activateOrganization(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = activateOrganizationSchema.safeParse({
    organizationId: formData.get("organizationId"),
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient().rpc("set_organization_status", {
    p_organization_id: parsed.data.organizationId,
    p_status: "active",
    p_actor: superadmin.email,
    p_period_start: parsed.data.periodStart ?? getJakartaDateString(),
    p_period_end: parsed.data.periodEnd ?? null,
  });
  if (error) return { ok: false, error: "Gagal mengaktifkan langganan" };
  await platformAudit(superadmin, "organization.status", "organization", parsed.data.organizationId, parsed.data.organizationId, {
    status: "active",
    periodStart: parsed.data.periodStart ?? null,
    periodEnd: parsed.data.periodEnd ?? null,
  });

  revalidatePath("/superadmin");
  return { ok: true, message: "Langganan diaktifkan" };
}

export async function setOrganizationStatus(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = organizationStatusSchema.safeParse({
    organizationId: formData.get("organizationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient().rpc("set_organization_status", {
    p_organization_id: parsed.data.organizationId,
    p_status: parsed.data.status,
    p_actor: superadmin.email,
  });
  if (error) return { ok: false, error: "Gagal mengubah status langganan" };
  await platformAudit(superadmin, "organization.status", "organization", parsed.data.organizationId, parsed.data.organizationId, {
    status: parsed.data.status,
  });

  revalidatePath("/superadmin");
  return { ok: true, message: "Status langganan diperbarui" };
}

export async function extendTrial(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = extendTrialSchema.safeParse({
    organizationId: formData.get("organizationId"),
    trialEndsAt: formData.get("trialEndsAt"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { data, error } = await createAdminSupabaseClient()
    .from("organization_subscriptions")
    .update({ trial_ends_at: parsed.data.trialEndsAt })
    .eq("organization_id", parsed.data.organizationId)
    .eq("status", "trial")
    .select("organization_id");
  if (error || !data?.length) return { ok: false, error: "Gagal memperpanjang trial. Pastikan statusnya Trial." };
  await platformAudit(superadmin, "organization.trial", "organization", parsed.data.organizationId, parsed.data.organizationId, {
    trialEndsAt: parsed.data.trialEndsAt,
  });

  revalidatePath("/superadmin");
  return { ok: true, message: "Masa trial diperbarui" };
}

export async function setClubLimitOverride(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = clubLimitOverrideSchema.safeParse({
    organizationId: formData.get("organizationId"),
    clubLimitOverride: formData.get("clubLimitOverride") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient()
    .from("organization_subscriptions")
    .update({ club_limit_override: parsed.data.clubLimitOverride ?? null })
    .eq("organization_id", parsed.data.organizationId);
  if (error) return { ok: false, error: error.code === "SW004" ? error.message : "Gagal menyimpan batas klub" };
  await platformAudit(superadmin, "organization.club_limit", "organization", parsed.data.organizationId, parsed.data.organizationId, {
    clubLimitOverride: parsed.data.clubLimitOverride ?? null,
  });

  revalidatePath("/superadmin");
  return { ok: true, message: "Batas klub diperbarui" };
}

export async function updatePlan(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = planEditSchema.safeParse({
    code: formData.get("code"),
    pricePerUserMonth: formData.get("pricePerUserMonth"),
    clubLimit: formData.get("clubLimit") ?? undefined,
    minSeats: formData.get("minSeats"),
    trialDays: formData.get("trialDays"),
    yearlyFreeMonths: formData.get("yearlyFreeMonths"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient()
    .from("subscription_plans")
    .update({
      price_per_seat_month: parsed.data.pricePerUserMonth,
      club_limit: parsed.data.clubLimit ?? null,
      min_seats: parsed.data.minSeats,
      trial_days: parsed.data.trialDays,
      yearly_free_months: parsed.data.yearlyFreeMonths,
      is_active: parsed.data.isActive === "true",
    })
    .eq("code", parsed.data.code);
  if (error) return { ok: false, error: "Gagal menyimpan paket" };
  await platformAudit(superadmin, "plan.update", "plan", null, null, {
    code: parsed.data.code,
    pricePerUserMonth: parsed.data.pricePerUserMonth,
    clubLimit: parsed.data.clubLimit ?? null,
    minSeats: parsed.data.minSeats,
    trialDays: parsed.data.trialDays,
    yearlyFreeMonths: parsed.data.yearlyFreeMonths,
    isActive: parsed.data.isActive === "true",
  });

  revalidatePath("/superadmin");
  revalidatePath("/");
  return { ok: true, message: "Paket diperbarui" };
}

const confirmRenewalSchema = z.object({
  renewalId: z.string().uuid("Pengajuan tidak valid"),
  reference: z.string().trim().max(200, "Referensi maksimal 200 karakter").optional(),
});

export async function confirmRenewalPayment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = confirmRenewalSchema.safeParse({
    renewalId: formData.get("renewalId"),
    reference: formData.get("reference") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { data, error } = await confirmRenewal(parsed.data.renewalId, superadmin.email, "manual", parsed.data.reference ?? null);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Referensi pembayaran ini sudah dipakai" };
    return { ok: false, error: error.code === "22023" || error.code === "SW004" ? error.message : "Gagal mengonfirmasi pembayaran" };
  }
  await platformAudit(superadmin, "subscription.renewal_confirm", "renewal", parsed.data.renewalId, null, {
    reference: parsed.data.reference ?? null,
    periodEnd: data,
  });

  revalidatePath("/superadmin");
  return { ok: true, message: "Pembayaran dikonfirmasi, langganan aktif" };
}

const issuerSchema = z.object({
  name: z.string().trim().min(1, "Nama penerbit wajib diisi").max(200, "Nama terlalu panjang"),
  address: z.string().trim().min(1, "Alamat wajib diisi").max(500, "Alamat terlalu panjang"),
  email: z.union([z.literal(""), z.string().trim().email("Email tidak valid").max(200, "Email terlalu panjang")]),
  website: z.string().trim().max(200, "Website terlalu panjang"),
  footer: z.string().trim().max(500, "Catatan terlalu panjang"),
});

export async function updateBillingIssuer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const parsed = issuerSchema.safeParse({
    name: formData.get("name") ?? "",
    address: formData.get("address") ?? "",
    email: formData.get("email") ?? "",
    website: formData.get("website") ?? "",
    footer: formData.get("footer") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const values = {
    name: parsed.data.name,
    address: parsed.data.address,
    email: parsed.data.email || null,
    website: parsed.data.website || null,
    footer: parsed.data.footer || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await createAdminSupabaseClient().from("billing_issuer").update(values).eq("id", true);
  if (error) return { ok: false, error: "Data penerbit gagal disimpan" };
  await platformAudit(superadmin, "billing.issuer_update", "billing_issuer", null, null, values);
  revalidatePath("/superadmin");
  return { ok: true, message: "Data penerbit disimpan. Berlaku untuk tagihan berikutnya." };
}
