"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { resolveClubTarget } from "@/lib/auth/contexts";
import { createSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { isKeyRateLimited } from "@/lib/auth/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createAccount, discardUnusedAccount, findAccountByEmail } from "@/lib/accounts/account";
import {
  createInvitation,
  findPendingInvitation,
  loadInvitationForAction,
  revokeInvitation,
} from "@/lib/accounts/invitations";
import { hashToken } from "@/lib/accounts/tokens";
import { getTenantRoles, isInstructorRole, organizationIdForTenant } from "@/lib/data/roles";
import { coachInviteSchema, staffInviteSchema } from "@/lib/validations/invitations";
import { passwordSchema } from "@/lib/validations/auth";
import { usernameSchema } from "@/lib/validations/username";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";
import { CONSENT_REQUIRED_ERROR, CONSENT_VERSION } from "@/lib/consent";

async function clubName(tenantId: string) {
  const { data } = await createAdminSupabaseClient().from("clubs").select("name").eq("id", tenantId).maybeSingle();
  return (data?.name as string | undefined) ?? "klub";
}

function inviteMessage(emailSent: boolean) {
  return emailSent
    ? "Undangan dikirim ke email penerima"
    : "Undangan dibuat. Kirim tautan di bawah ke penerima; tautan hanya ditampilkan sekali.";
}

async function sendClubInvitation(
  session: { sub: string; account_id: string; club_id: string; full_name?: string; app_role: string },
  input: { fullName: string; email: string; roleId: string }
): Promise<ActionState> {
  const organizationId = await organizationIdForTenant(session.club_id);
  if (!organizationId) return { ok: false, error: "Organisasi tidak ditemukan" };
  const result = await createInvitation({
    organizationId,
    tenantId: session.club_id,
    kind: "staff",
    roleId: input.roleId,
    email: input.email,
    fullName: input.fullName,
    invitedBy: session.account_id,
    inviterName: session.full_name ?? "Admin klub",
    where: await clubName(session.club_id),
  });
  if (!result.ok) return { ok: false, error: result.error };
  await logAudit({
    action: "invitation.create",
    targetType: "invitation",
    details: { role: input.roleId },
    tenantId: session.club_id,
    organizationId,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  return { ok: true, message: inviteMessage(result.emailSent), link: result.emailSent ? undefined : result.link };
}

export async function inviteStaff(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("staff.manage");
  const parsed = staffInviteSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    roleId: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const roles = (await getTenantRoles(session.club_id)).filter((r) => !isInstructorRole(r));
  if (!roles.some((r) => r.id === parsed.data.roleId)) return { ok: false, error: "Peran tidak valid" };
  const result = await sendClubInvitation(session, parsed.data);
  revalidatePath("/admin/staff");
  return result;
}

export async function inviteCoach(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("coaches.manage");
  const parsed = coachInviteSchema.safeParse({ fullName: formData.get("fullName"), email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const roles = (await getTenantRoles(session.club_id)).filter(isInstructorRole);
  const role = roles.find((r) => r.presetKey === "pelatih") ?? roles[0];
  if (!role) return { ok: false, error: "Belum ada peran pelatih. Buat peran dengan izin menjadi pelatih terlebih dulu." };
  const result = await sendClubInvitation(session, { ...parsed.data, roleId: role.id });
  revalidatePath("/admin/coaches");
  return result;
}

const idSchema = z.object({ invitationId: z.string().uuid("Undangan tidak valid") });

export async function resendInvitation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission(["staff.manage", "coaches.manage"]);
  const parsed = idSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) return { ok: false, error: "Undangan tidak valid" };
  const invitation = await loadInvitationForAction(parsed.data.invitationId, { tenantId: session.club_id });
  if (!invitation?.org_role_id) return { ok: false, error: "Undangan tidak ditemukan" };
  const result = await sendClubInvitation(session, {
    fullName: invitation.full_name as string,
    email: invitation.email as string,
    roleId: invitation.org_role_id as string,
  });
  revalidatePath("/admin/staff");
  revalidatePath("/admin/coaches");
  return result;
}

export async function revokeInvitationAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission(["staff.manage", "coaches.manage"]);
  const parsed = idSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) return { ok: false, error: "Undangan tidak valid" };
  const invitation = await loadInvitationForAction(parsed.data.invitationId, { tenantId: session.club_id });
  if (!invitation) return { ok: false, error: "Undangan tidak ditemukan" };
  await revokeInvitation(invitation.id as string);
  await logAudit({
    action: "invitation.revoke",
    targetType: "invitation",
    targetId: invitation.id as string,
    tenantId: session.club_id,
    organizationId: invitation.organization_id as string,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidatePath("/admin/staff");
  revalidatePath("/admin/coaches");
  return { ok: true, message: "Undangan dibatalkan" };
}

const ACCEPT_ERRORS: Record<string, string> = {
  IV002: "Undangan ini untuk email lain. Masuk dengan akun yang sesuai.",
  IV003: "Akun ini sudah terhubung ke klub atau organisasi tersebut.",
};

type Accepted = { out_kind: "staff" | "owner"; out_organization_id: string; out_club_id: string | null; out_profile_id: string };

async function accept(token: string, accountId: string): Promise<{ ok: true; row: Accepted } | { ok: false; error: string }> {
  const { data, error } = await createAdminSupabaseClient().rpc("accept_invitation", {
    p_token_hash: hashToken(token),
    p_account_id: accountId,
  });
  if (error) {
    if (error.code && ACCEPT_ERRORS[error.code]) return { ok: false, error: ACCEPT_ERRORS[error.code] };
    if (error.code && PLAN_LIMIT_CODES.has(error.code)) return { ok: false, error: error.message };
    return { ok: false, error: "Gagal menerima undangan" };
  }
  const row = (data as Accepted[] | null)?.[0];
  if (!row) return { ok: false, error: "Undangan sudah tidak berlaku. Minta undangan baru." };
  return { ok: true, row };
}

async function recordAccepted(row: Accepted, accountId: string) {
  await logAudit({
    action: "invitation.accept",
    targetType: "account",
    targetId: accountId,
    details: { kind: row.out_kind },
    tenantId: row.out_club_id,
    organizationId: row.out_organization_id,
    actorId: row.out_profile_id,
    actorRole: row.out_kind === "owner" ? "owner" : "staff",
  });
}

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);

export async function acceptInvitationAsCurrent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const token = tokenSchema.safeParse(formData.get("token"));
  if (!token.success) return { ok: false, error: "Undangan tidak valid" };
  const session = await getSession();
  if (!session?.account_id) redirect(`/login?next=${encodeURIComponent(`/i/${token.data}`)}`);
  const result = await accept(token.data, session.account_id);
  if (!result.ok) return result;
  await recordAccepted(result.row, session.account_id);
  redirect("/");
}

const newAccountSchema = z.object({
  token: tokenSchema,
  username: usernameSchema,
  password: passwordSchema,
  acceptTerms: z.literal("on", { message: CONSENT_REQUIRED_ERROR }),
});

export async function acceptInvitationNewAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newAccountSchema.safeParse({
    token: formData.get("token"),
    username: formData.get("username"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Data tidak valid",
      fieldErrors: issue?.path[0] === "username" ? { username: issue.message } : undefined,
    };
  }
  const { token, username, password } = parsed.data;
  if (await isKeyRateLimited(`invite-accept:${hashToken(token)}`, 10, 3600, true)) {
    return { ok: false, error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }
  const invitation = await findPendingInvitation(token);
  if (!invitation) return { ok: false, error: "Undangan sudah tidak berlaku. Minta undangan baru." };
  if (await findAccountByEmail(invitation.email)) {
    return { ok: false, error: "Email ini sudah punya akun. Masuk untuk menerima undangan." };
  }

  const account = await createAccount({
    email: invitation.email,
    username,
    fullName: invitation.fullName,
    passwordHash: await hashPassword(password),
    emailVerified: invitation.emailSent,
  });
  if (!account.ok) {
    return { ok: false, error: account.error, fieldErrors: account.field === "username" ? { username: account.error } : undefined };
  }
  const result = await accept(token, account.id);
  if (!result.ok) {
    await discardUnusedAccount(account.id);
    return result;
  }
  const supabase = createAdminSupabaseClient();
  await supabase.from("consents").insert({
    subject_type: "account",
    subject_id: account.id,
    kind: "terms_privacy",
    version: CONSENT_VERSION,
  });
  await recordAccepted(result.row, account.id);

  const target = await resolveClubTarget({ id: account.id, email: invitation.email, full_name: invitation.fullName });
  if (typeof target === "string") redirect("/login");
  await createSession({
    id: target.profileId,
    accountId: account.id,
    email: target.email,
    fullName: target.fullName,
    role: target.role,
    tenantId: target.tenantId,
    orgId: target.orgId,
  });
  redirect(target.redirectTo);
}
