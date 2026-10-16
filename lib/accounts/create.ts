import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { createAccount, discardUnusedAccount, findAccountByEmail } from "@/lib/accounts/account";
import { grantPaidMembership, syncPaidMembership } from "@/lib/accounts/staff-seat";
import { PLAN_LIMIT_CODES, type ActionState } from "@/lib/actions/types";

export async function createTenantAccount(
  tenantId: string,
  roleId: string,
  input: { fullName: string; email: string; username: string; phone?: string },
  failureMessage: string
): Promise<ActionState> {
  const supabase = createAdminSupabaseClient();
  const { data: tenant } = await supabase.from("tenants").select("organization_id").eq("id", tenantId).maybeSingle();
  const { data: role } = await supabase
    .from("organization_roles")
    .select("id, is_paid, organization_id")
    .eq("id", roleId)
    .maybeSingle();
  if (!tenant || !role || role.organization_id !== tenant.organization_id) {
    return { ok: false, error: "Peran tidak valid", fieldErrors: undefined };
  }

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

  const cleanup = async () => {
    await syncPaidMembership(account.id, tenant.organization_id as string);
    await discardUnusedAccount(account.id);
  };

  if (role.is_paid) {
    const seatFailure = await grantPaidMembership({
      accountId: account.id,
      organizationId: tenant.organization_id as string,
      tenantId,
      email: input.email,
      fullName: input.fullName,
    });
    if (seatFailure) {
      await supabase.from("organization_members").delete().eq("account_id", account.id);
      await discardUnusedAccount(account.id);
      return { ok: false, error: seatFailure };
    }
  }

  const { error } = await supabase.from("profiles").insert({
    tenant_id: tenantId,
    account_id: account.id,
    role: "staff",
    org_role_id: roleId,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
  });

  if (error) {
    await supabase.from("organization_members").delete().eq("account_id", account.id);
    await cleanup();
    if (error.code === "23505") return { ok: false, error: "Email sudah terdaftar" };
    return { ok: false, error: PLAN_LIMIT_CODES.has(error.code) ? error.message : failureMessage };
  }

  return { ok: true, tempPassword };
}
