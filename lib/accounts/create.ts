import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import type { AppRole } from "@/lib/auth/roles";
import { PLAN_LIMIT_CODES, type ActionState } from "@/lib/actions/types";
import { usernameDbError } from "@/lib/validations/username";

export async function createTenantAccount(
  tenantId: string,
  role: AppRole,
  input: { fullName: string; email: string; username: string; phone?: string },
  failureMessage: string
): Promise<ActionState> {
  const supabase = createAdminSupabaseClient();
  const [{ data: existing }, { data: ownerExisting }] = await Promise.all([
    supabase.from("profiles").select("id").eq("email", input.email).is("owner_id", null).maybeSingle(),
    supabase.from("org_owners").select("id").eq("email", input.email).maybeSingle(),
  ]);
  if (existing || ownerExisting) {
    return { ok: false, error: "Email sudah terdaftar" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({
      tenant_id: tenantId,
      role,
      full_name: input.fullName,
      email: input.email,
      username: input.username,
      phone: input.phone ?? null,
      must_change_password: true,
    })
    .select("id")
    .single();

  if (error || !profile) {
    const usernameError = usernameDbError(error?.message);
    if (usernameError) return { ok: false, error: usernameError, fieldErrors: { username: usernameError } };
    if (error?.code === "23505") return { ok: false, error: "Email sudah terdaftar" };
    return { ok: false, error: error && PLAN_LIMIT_CODES.has(error.code) ? error.message : failureMessage };
  }

  const tempPassword = generateTempPassword();
  const { error: credError } = await supabase
    .from("auth_credentials")
    .insert({ profile_id: profile.id, password_hash: await hashPassword(tempPassword) });

  if (credError) {
    await supabase.from("profiles").delete().eq("id", profile.id);
    return { ok: false, error: "Gagal membuat kredensial akun" };
  }

  return { ok: true, tempPassword };
}
