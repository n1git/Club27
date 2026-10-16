"use server";

import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createPasswordReset } from "@/lib/accounts/password-reset";
import { organizationIdForTenant } from "@/lib/data/roles";
import { type ActionState } from "./types";

const resetSchema = z.object({ profileId: z.string().uuid("Akun tidak valid") });

export async function resetUserPassword(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireActionPermission("staff.manage");
  const parsed = resetSchema.safeParse({ profileId: formData.get("profileId") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = createAdminSupabaseClient();
  const [{ data: profile }, { data: caller }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, account_id")
      .eq("id", parsed.data.profileId)
      .eq("tenant_id", session.tenant_id)
      .eq("role", "staff")
      .neq("id", session.sub)
      .maybeSingle(),
    supabase.from("profiles").select("owner_id").eq("id", session.sub).maybeSingle(),
  ]);
  if (!profile) return { ok: false, error: "Akun tidak ditemukan" };
  const { data: granted } = await supabase.rpc("profile_permissions", { p_profile: profile.id });
  if (((granted as string[] | null) ?? []).includes("staff.manage") && !caller?.owner_id) {
    return { ok: false, error: "Hanya pemilik yang dapat mengatur ulang kata sandi pengelola staf" };
  }

  if (!profile.account_id) return { ok: false, error: "Akun tidak ditemukan" };
  const organizationId = await organizationIdForTenant(session.tenant_id);
  const [{ data: otherProfiles }, { data: memberships }, { count: memberAccounts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, tenants(organization_id)")
      .eq("account_id", profile.account_id)
      .neq("id", profile.id),
    supabase.from("organization_members").select("organization_id, base_role").eq("account_id", profile.account_id),
    supabase.from("member_accounts").select("id", { count: "exact", head: true }).eq("account_id", profile.account_id),
  ]);
  const foreignProfiles = (otherProfiles ?? []).filter((p) => {
    const tenant = p.tenants as unknown as { organization_id: string } | { organization_id: string }[] | null;
    return (Array.isArray(tenant) ? tenant[0]?.organization_id : tenant?.organization_id) !== organizationId;
  });
  const foreignMemberships = (memberships ?? []).filter((m) => m.organization_id !== organizationId || m.base_role !== "staff");
  if (foreignProfiles.length || foreignMemberships.length || memberAccounts) {
    return { ok: false, error: "Akun ini juga terhubung ke konteks lain. Kata sandi hanya bisa diatur ulang oleh pemiliknya." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, email, full_name")
    .eq("id", profile.account_id)
    .maybeSingle();
  if (!account) return { ok: false, error: "Akun tidak ditemukan" };
  const reset = await createPasswordReset(account as { id: string; email: string; full_name: string }, session.account_id);
  if (!reset) return { ok: false, error: "Gagal membuat tautan atur ulang" };

  await logAudit({
    action: "password.reset",
    targetType: "profile",
    targetId: profile.id,
    details: { role: profile.role },
    tenantId: session.tenant_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  return {
    ok: true,
    message: reset.emailSent
      ? "Tautan atur ulang dikirim ke email akun. Berlaku 1 jam."
      : "Tautan atur ulang dibuat. Berikan ke pemilik akun; berlaku 1 jam dan hanya ditampilkan sekali.",
    link: reset.emailSent ? undefined : reset.link,
  };
}
