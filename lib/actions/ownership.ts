"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrimaryOwnerAction } from "@/lib/auth/owner";
import { verifyReauth } from "@/lib/auth/reauth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createInvitation, loadInvitationForAction, revokeInvitation } from "@/lib/accounts/invitations";
import { ownerInviteSchema } from "@/lib/validations/invitations";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "./types";

const TRANSFER_ERRORS: Record<string, string> = {
  OW001: "Hanya pemilik utama yang dapat memindahkan kepemilikan",
  OW002: "Penerima harus pemilik aktif organisasi ini",
};

export async function inviteOwner(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requirePrimaryOwnerAction();
  const reauth = await verifyReauth(owner.accountId, formData.get("confirmPassword"));
  if (reauth) return { ok: false, error: reauth };
  const parsed = ownerInviteSchema.safeParse({ fullName: formData.get("fullName"), email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = createAdminSupabaseClient();
  const [{ data: org }, { data: account }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", owner.organizationId).maybeSingle(),
    supabase.from("accounts").select("full_name").eq("id", owner.accountId).maybeSingle(),
  ]);
  const result = await createInvitation({
    organizationId: owner.organizationId,
    tenantId: null,
    kind: "owner",
    roleId: null,
    email: parsed.data.email,
    fullName: parsed.data.fullName,
    invitedBy: owner.accountId,
    inviterName: (account?.full_name as string | undefined) ?? "Pemilik organisasi",
    where: (org?.name as string | undefined) ?? "organisasi",
  });
  if (!result.ok) return { ok: false, error: result.error };
  await logAudit({
    action: "invitation.create_owner",
    targetType: "organization",
    targetId: owner.organizationId,
    tenantId: owner.tenantId,
    organizationId: owner.organizationId,
    actorId: owner.profileId,
    actorRole: "owner",
  });
  revalidatePath("/admin/club/owners");
  return {
    ok: true,
    message: result.emailSent ? "Undangan dikirim ke email penerima" : "Undangan dibuat. Kirim tautan di bawah ke penerima; tautan hanya ditampilkan sekali.",
    link: result.emailSent ? undefined : result.link,
  };
}

export async function revokeOwnerInvitation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requirePrimaryOwnerAction();
  const id = z.string().uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return { ok: false, error: "Undangan tidak valid" };
  const invitation = await loadInvitationForAction(id.data, { organizationId: owner.organizationId });
  if (!invitation) return { ok: false, error: "Undangan tidak ditemukan" };
  await revokeInvitation(invitation.id as string);
  revalidatePath("/admin/club/owners");
  return { ok: true, message: "Undangan dibatalkan" };
}

export async function transferOwnership(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requirePrimaryOwnerAction();
  const reauth = await verifyReauth(owner.accountId, formData.get("confirmPassword"));
  if (reauth) return { ok: false, error: reauth };
  const target = z.string().uuid("Pilih penerima").safeParse(formData.get("memberId"));
  if (!target.success) return { ok: false, error: "Pilih penerima" };

  const { error } = await createAdminSupabaseClient().rpc("transfer_ownership", {
    p_org: owner.organizationId,
    p_to_member: target.data,
    p_actor_account: owner.accountId,
  });
  if (error) return { ok: false, error: (error.code && TRANSFER_ERRORS[error.code]) || "Gagal memindahkan kepemilikan" };

  await logAudit({
    action: "ownership.transfer",
    targetType: "organization",
    targetId: owner.organizationId,
    details: { from_member: owner.ownerId, to_member: target.data },
    tenantId: owner.tenantId,
    organizationId: owner.organizationId,
    actorId: owner.profileId,
    actorRole: "owner",
  });
  revalidatePath("/admin/club/owners");
  return { ok: true, message: "Kepemilikan utama dipindahkan" };
}
