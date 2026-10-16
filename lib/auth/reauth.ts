import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { isKeyLocked, recordFailure } from "@/lib/auth/rate-limit";

export const REAUTH_ERROR = "Kata sandi konfirmasi salah";
const REAUTH_LOCKED = "Terlalu banyak percobaan konfirmasi. Coba lagi beberapa menit lagi.";

export async function verifyReauth(accountId: string, password: unknown): Promise<string | null> {
  const key = `reauth:${accountId}`;
  if (await isKeyLocked(key, 5, 600)) return REAUTH_LOCKED;
  if (typeof password !== "string" || password.length === 0 || password.length > 128) return REAUTH_ERROR;
  const { data } = await createAdminSupabaseClient()
    .from("accounts")
    .select("password_hash, is_active")
    .eq("id", accountId)
    .maybeSingle();
  const valid = await verifyPasswordOrDummy(password, data?.is_active ? (data.password_hash as string) : null);
  if (valid) return null;
  await recordFailure(key, 600);
  return REAUTH_ERROR;
}
