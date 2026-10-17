import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { usernameDbError } from "@/lib/validations/username";

export interface NewAccount {
  email: string;
  username: string;
  fullName: string;
  passwordHash: string;
  mustChangePassword?: boolean;
  emailVerified?: boolean;
}

export type CreateAccountResult =
  | { ok: true; id: string }
  | { ok: false; error: string; field?: "username" | "email" };

export async function findAccountByEmail(email: string) {
  const { data } = await createAdminSupabaseClient()
    .from("accounts")
    .select("id, email, full_name, is_active, email_verified_at")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return data as {
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    email_verified_at: string | null;
  } | null;
}

export async function createAccount(input: NewAccount): Promise<CreateAccountResult> {
  const { data, error } = await createAdminSupabaseClient()
    .from("accounts")
    .insert({
      email: input.email.trim().toLowerCase(),
      username: input.username,
      full_name: input.fullName,
      password_hash: input.passwordHash,
      must_change_password: input.mustChangePassword ?? false,
      email_verified_at: input.emailVerified ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    const usernameError = usernameDbError(error?.message);
    if (usernameError) return { ok: false, error: usernameError, field: "username" };
    if (error?.code === "23505") return { ok: false, error: "Email sudah terdaftar", field: "email" };
    return { ok: false, error: "Gagal membuat akun" };
  }
  return { ok: true, id: data.id as string };
}

export async function discardUnusedAccount(accountId: string) {
  const supabase = createAdminSupabaseClient();
  const [{ count: profiles }, { count: owners }] = await Promise.all([
    supabase.from("club_profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("organization_users").select("id", { count: "exact", head: true }).eq("account_id", accountId),
  ]);
  if (!profiles && !owners) await supabase.from("accounts").delete().eq("id", accountId);
}

export async function revokeAccountSessions(accountId: string) {
  await createAdminSupabaseClient()
    .from("accounts")
    .update({ sessions_valid_after: new Date(Math.floor(Date.now() / 1000) * 1000).toISOString() })
    .eq("id", accountId);
}
