"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { createSession } from "@/lib/auth/session";
import { isKeyRateLimited } from "@/lib/auth/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createTenantSchema } from "@/lib/validations/onboarding";
import { BILLING_PERIODS, PLAN_CODES, type BillingPeriod, type PlanCode } from "@/lib/pricing";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { newToken } from "@/lib/accounts/tokens";
import { escapeHtml } from "@/lib/accounts/mail";
import { SITE_URL } from "@/lib/site";
import { APP_NAME } from "@/lib/config";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "./types";

const schema = createTenantSchema.extend({
  planCode: z.enum(PLAN_CODES as [PlanCode, ...PlanCode[]], { message: "Pilih paket" }),
  billingPeriod: z.enum(BILLING_PERIODS as [BillingPeriod, ...BillingPeriod[]], { message: "Pilih periode" }),
  acceptTerms: z.literal("on", { message: "Setujui Syarat & Ketentuan dan Kebijakan Privasi untuk mendaftar" }),
});

type Created = { organization_id: string; tenant_id: string; owner_id: string; profile_id: string };

export async function createOrganizationFromAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole(["personal", "member", "staff", "owner"]);
  const parsed = schema.safeParse({
    tenantName: formData.get("tenantName"),
    clubType: formData.get("clubType") ?? undefined,
    planCode: formData.get("planCode"),
    billingPeriod: formData.get("billingPeriod"),
    acceptTerms: formData.get("acceptTerms"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  if (await isKeyRateLimited(`org-create:${session.account_id}`, 3, 3600, true)) {
    return { ok: false, error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }

  const supabase = createAdminSupabaseClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, email, full_name, email_verified_at")
    .eq("id", session.account_id)
    .maybeSingle();
  if (!account) return { ok: false, error: "Akun tidak ditemukan" };

  const args = {
    p_organization_name: parsed.data.tenantName,
    p_tenant_name: parsed.data.tenantName,
    p_account_id: account.id,
    p_plan: parsed.data.planCode,
    p_period: parsed.data.billingPeriod,
    p_club_type: parsed.data.clubType,
  };
  const failure = (message?: string): ActionState =>
    message?.includes("club type not available") || message?.includes("plan not available")
      ? { ok: false, error: "Paket atau jenis klub tidak tersedia" }
      : { ok: false, error: "Gagal membuat organisasi. Coba lagi nanti." };

  const needsVerification = isEmailConfigured() && !account.email_verified_at;
  let created: Created | undefined;
  if (needsVerification) {
    const { token, hash } = newToken();
    const { data, error } = await supabase.rpc("register_organization_unverified", { ...args, p_token_hash: hash });
    created = (data as Created[] | null)?.[0];
    if (error || !created) return failure(error?.message);
    const link = `${SITE_URL}/api/onboarding/verify?token=${token}`;
    await sendEmail({
      to: account.email as string,
      subject: `Verifikasi email pendaftaran ${APP_NAME}`,
      text: `Halo ${account.full_name},\n\nBuka tautan ini dalam 24 jam untuk menyelesaikan pembuatan organisasi Anda:\n${link}\n\nAbaikan email ini jika Anda tidak memintanya.`,
      html: `<p>Halo ${escapeHtml(account.full_name as string)},</p><p>Buka tautan ini dalam 24 jam untuk menyelesaikan pembuatan organisasi Anda:</p><p><a href="${link}">${link}</a></p><p>Abaikan email ini jika Anda tidak memintanya.</p>`,
    });
  } else {
    const { data, error } = await supabase.rpc("register_organization", args);
    created = (data as Created[] | null)?.[0];
    if (error || !created) return failure(error?.message);
  }

  await supabase.from("consents").insert({
    tenant_id: created.tenant_id,
    organization_id: created.organization_id,
    subject_type: "owner",
    subject_id: created.owner_id,
    kind: "terms_privacy",
    version: PRIVACY_VERSION,
  });
  await logAudit({
    action: "organization.create_from_account",
    targetType: "organization",
    targetId: created.organization_id,
    tenantId: created.tenant_id,
    organizationId: created.organization_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });

  if (needsVerification) {
    return { ok: true, message: "Kami mengirim tautan verifikasi ke email Anda. Buka tautan itu untuk mengaktifkan organisasi." };
  }
  await createSession({
    id: created.profile_id,
    accountId: account.id as string,
    email: account.email as string,
    fullName: account.full_name as string,
    role: "owner",
    tenantId: created.tenant_id,
    orgId: created.organization_id,
  });
  redirect("/admin/onboarding");
}
