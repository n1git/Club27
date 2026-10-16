import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { invitationEmail } from "@/lib/accounts/mail";
import { hashToken, newToken, TOKEN_PATTERN } from "@/lib/accounts/tokens";

export const INVITATION_DAYS = 7;

export interface InvitationView {
  id: string;
  kind: "staff" | "owner";
  email: string;
  fullName: string;
  organizationName: string;
  clubName: string | null;
  roleName: string | null;
  emailSent: boolean;
}

type One<T> = T | T[] | null;
const one = <T>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

export async function findPendingInvitation(token: string): Promise<InvitationView | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const { data } = await createAdminSupabaseClient()
    .from("invitations")
    .select("id, kind, email, full_name, email_sent, organizations(name), tenants(name), organization_roles(name)")
    .eq("token_hash", hashToken(token))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    kind: data.kind as "staff" | "owner",
    email: data.email as string,
    fullName: data.full_name as string,
    organizationName: one(data.organizations as One<{ name: string }>)?.name ?? "",
    clubName: one(data.tenants as One<{ name: string }>)?.name ?? null,
    roleName: one(data.organization_roles as One<{ name: string }>)?.name ?? null,
    emailSent: Boolean(data.email_sent),
  };
}

export interface NewInvitation {
  organizationId: string;
  tenantId: string | null;
  kind: "staff" | "owner";
  roleId: string | null;
  email: string;
  fullName: string;
  invitedBy: string;
  inviterName: string;
  where: string;
}

export type InvitationResult = { ok: true; link: string; emailSent: boolean } | { ok: false; error: string };

const KNOWN_CODES = new Set(["IV001", "22023", "SW003"]);

export async function createInvitation(input: NewInvitation): Promise<InvitationResult> {
  const supabase = createAdminSupabaseClient();
  const { token, hash } = newToken();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_org: input.organizationId,
    p_tenant: input.tenantId,
    p_kind: input.kind,
    p_role: input.roleId,
    p_email: input.email,
    p_name: input.fullName,
    p_token_hash: hash,
    p_invited_by: input.invitedBy,
  });
  if (error || !data) {
    return { ok: false, error: error?.code && KNOWN_CODES.has(error.code) ? error.message : "Gagal membuat undangan" };
  }
  const link = `${SITE_URL}/undangan/${token}`;
  let emailSent = false;
  if (isEmailConfigured()) {
    emailSent = await sendEmail({
      to: input.email.trim().toLowerCase(),
      ...invitationEmail({ link, name: input.fullName, inviter: input.inviterName, where: input.where, days: INVITATION_DAYS }),
    });
    if (emailSent) await supabase.from("invitations").update({ email_sent: true }).eq("id", data as string);
  }
  return { ok: true, link, emailSent };
}

export interface PendingInvitationRow {
  id: string;
  email: string;
  fullName: string;
  kind: "staff" | "owner";
  roleId: string | null;
  tenantId: string | null;
  roleName: string | null;
  expiresAt: string;
}

export async function listPendingInvitations(scope: { tenantId: string } | { organizationId: string; kind: "owner" }) {
  let query = createAdminSupabaseClient()
    .from("invitations")
    .select("id, email, full_name, kind, org_role_id, tenant_id, expires_at, organization_roles(name)")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  query = "tenantId" in scope ? query.eq("tenant_id", scope.tenantId) : query.eq("organization_id", scope.organizationId).eq("kind", scope.kind);
  const { data } = await query;
  return (data ?? []).map(
    (row): PendingInvitationRow => ({
      id: row.id as string,
      email: row.email as string,
      fullName: row.full_name as string,
      kind: row.kind as "staff" | "owner",
      roleId: row.org_role_id as string | null,
      tenantId: row.tenant_id as string | null,
      roleName: one(row.organization_roles as One<{ name: string }>)?.name ?? null,
      expiresAt: row.expires_at as string,
    })
  );
}

export async function loadInvitationForAction(id: string, scope: { tenantId: string } | { organizationId: string }) {
  let query = createAdminSupabaseClient()
    .from("invitations")
    .select("id, organization_id, tenant_id, kind, org_role_id, email, full_name, status")
    .eq("id", id)
    .eq("status", "pending");
  query = "tenantId" in scope ? query.eq("tenant_id", scope.tenantId) : query.eq("organization_id", scope.organizationId).eq("kind", "owner");
  const { data } = await query.maybeSingle();
  return data;
}

export async function revokeInvitation(id: string) {
  await createAdminSupabaseClient().from("invitations").update({ status: "revoked" }).eq("id", id).eq("status", "pending");
}
