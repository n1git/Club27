import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import type { AppRole } from "@/lib/auth/roles";
import { createAccount, discardUnusedAccount, findAccountByEmail } from "@/lib/accounts/account";
import { PLAN_LIMIT_CODES, type ActionState } from "@/lib/actions/types";

export async function createTenantAccount(
  tenantId: string,
  role: AppRole,
  input: { fullName: string; email: string; username: string; phone?: string },
  failureMessage: string
): Promise<ActionState> {
  if (await findAccountByEmail(input.email)) {
    return { ok: false, error: "Email sudah terdaftar" };
  }

  const tempPassword = generateTempPassword();
  const account = await createAccount({
    email: input.email,
    username: input.username,
    fullName: input.fullName,
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
  });
  if (!account.ok) {
    if (account.field === "username") return { ok: false, error: account.error, fieldErrors: { username: account.error } };
    return { ok: false, error: account.error };
  }

  const { error } = await createAdminSupabaseClient().from("profiles").insert({
    tenant_id: tenantId,
    account_id: account.id,
    role,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
  });

  if (error) {
    await discardUnusedAccount(account.id);
    if (error.code === "23505") return { ok: false, error: "Email sudah terdaftar" };
    return { ok: false, error: PLAN_LIMIT_CODES.has(error.code) ? error.message : failureMessage };
  }

  return { ok: true, tempPassword };
}
