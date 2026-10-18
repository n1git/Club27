import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/actions/types";

export const SOCIAL_BANNED_ERROR = "Fitur sosial dinonaktifkan untuk akun ini";

export async function isSocialBanned(accountId: string): Promise<boolean> {
  const { data } = await createAdminSupabaseClient().from("accounts").select("social_banned_at").eq("id", accountId).maybeSingle();
  return Boolean(data?.social_banned_at);
}

export async function socialBlocked(accountId: string): Promise<ActionState | null> {
  return (await isSocialBanned(accountId)) ? { ok: false, error: SOCIAL_BANNED_ERROR } : null;
}
