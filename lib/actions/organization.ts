"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { requirePrimaryOwnerAction } from "@/lib/auth/owner";
import { verifyReauth } from "@/lib/auth/reauth";
import { revalidatePath } from "next/cache";
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
import { logAudit } from "@/lib/audit";
import type { ActionState } from "./types";
import { CONSENT_REQUIRED_ERROR, CONSENT_VERSION } from "@/lib/consent";

const schema = createTenantSchema.extend({
  planCode: z.enum(PLAN_CODES as [PlanCode, ...PlanCode[]], { message: "Pilih paket" }),
  billingPeriod: z.enum(BILLING_PERIODS as [BillingPeriod, ...BillingPeriod[]], { message: "Pilih periode" }),
  acceptTerms: z.literal("on", { message: CONSENT_REQUIRED_ERROR }),
});

type Created = { organization_id: string; club_id: string; owner_id: string; profile_id: string };

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
    p_club_name: parsed.data.tenantName,
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
    club_id: created.club_id,
    organization_id: created.organization_id,
    subject_type: "owner",
    subject_id: created.owner_id,
    kind: "terms_privacy",
    version: CONSENT_VERSION,
  });
  await logAudit({
    action: "organization.create_from_account",
    targetType: "organization",
    targetId: created.organization_id,
    tenantId: created.club_id,
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
    tenantId: created.club_id,
    orgId: created.organization_id,
  });
  redirect("/admin/onboarding");
}

const deletionSchema = z.object({ confirmName: z.string().trim().min(1, "Ketik nama organisasi untuk mengonfirmasi") });

export async function requestOrganizationDeletion(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requirePrimaryOwnerAction();
  const reauth = await verifyReauth(owner.accountId, formData.get("confirmPassword"));
  if (reauth) return { ok: false, error: reauth };
  const parsed = deletionSchema.safeParse({ confirmName: formData.get("confirmName") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = createAdminSupabaseClient();
  const [{ data: org }, { data: account }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", owner.organizationId).maybeSingle(),
    supabase.from("accounts").select("id, email, full_name").eq("id", owner.accountId).maybeSingle(),
  ]);
  if (!org || !account) return { ok: false, error: "Organisasi tidak ditemukan" };
  if (parsed.data.confirmName !== org.name) return { ok: false, error: "Nama organisasi tidak sama" };

  const { error } = await supabase.rpc("request_organization_deletion", {
    p_org: owner.organizationId,
    p_actor_account: owner.accountId,
  });
  if (error) {
    return { ok: false, error: error.code === "DL001" || error.code === "22023" ? error.message : "Gagal meminta penghapusan" };
  }
  await logAudit({
    action: "organization.delete_request",
    targetType: "organization",
    targetId: owner.organizationId,
    tenantId: owner.tenantId,
    organizationId: owner.organizationId,
    actorId: owner.profileId,
    actorRole: "owner",
  });
  await createSession({
    id: account.id as string,
    accountId: account.id as string,
    email: account.email as string,
    fullName: account.full_name as string,
    role: "personal",
    tenantId: "",
    orgId: "",
  });
  redirect("/");
}

export async function cancelOrganizationDeletion(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole(["personal"]);
  const reauth = await verifyReauth(session.account_id, formData.get("confirmPassword"));
  if (reauth) return { ok: false, error: reauth };
  const organizationId = z.string().uuid().safeParse(formData.get("organizationId"));
  if (!organizationId.success) return { ok: false, error: "Organisasi tidak valid" };

  const { error } = await createAdminSupabaseClient().rpc("cancel_organization_deletion", {
    p_org: organizationId.data,
    p_actor_account: session.account_id,
  });
  if (error) {
    return { ok: false, error: error.code === "DL002" || error.code === "OW001" ? error.message : "Gagal memulihkan organisasi" };
  }
  await logAudit({
    action: "organization.delete_cancel",
    targetType: "organization",
    targetId: organizationId.data,
    organizationId: organizationId.data,
    actorId: session.sub,
    actorRole: "account",
  });
  revalidatePath("/");
  return { ok: true, message: "Organisasi dipulihkan. Masuk lagi untuk membukanya." };
}
