"use server";

import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
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
  const [{ count: otherProfiles }, { count: owners }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_id", profile.account_id)
      .neq("id", profile.id),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("account_id", profile.account_id),
  ]);
  if (otherProfiles || owners) {
    return { ok: false, error: "Akun ini juga terhubung ke konteks lain. Kata sandi hanya bisa diatur ulang oleh pemiliknya." };
  }

  const tempPassword = generateTempPassword();
  const { error: accountError } = await supabase
    .from("accounts")
    .update({
      password_hash: await hashPassword(tempPassword),
      must_change_password: true,
      failed_login_count: 0,
      locked_until: null,
      sessions_valid_after: new Date().toISOString(),
    })
    .eq("id", profile.account_id);
  if (accountError) return { ok: false, error: "Gagal mengatur ulang kata sandi" };

  await logAudit({
    action: "password.reset",
    targetType: "profile",
    targetId: profile.id,
    details: { role: profile.role },
    tenantId: session.tenant_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  return { ok: true, message: "Kata sandi sementara baru dibuat", tempPassword };
}
