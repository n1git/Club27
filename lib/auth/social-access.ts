import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isMinor } from "@/lib/privacy";
import type { ActionState } from "@/lib/actions/types";

export const SOCIAL_BANNED_ERROR = "Fitur sosial dinonaktifkan untuk akun ini";
export const SOCIAL_MINOR_ERROR = "Fitur ini hanya untuk pengguna berusia 18 tahun ke atas";

export type SocialRestriction = "banned" | "minor" | null;

export async function isMinorAccount(accountId: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const { data: profiles } = await supabase.from("club_profiles").select("id").eq("account_id", accountId).eq("role", "member");
  const ids = (profiles ?? []).map((p) => p.id as string);
  if (!ids.length) return false;
  const { data: members } = await supabase.from("club_members").select("date_of_birth").in("profile_id", ids);
  return (members ?? []).some((m) => Boolean(m.date_of_birth) && isMinor(m.date_of_birth as string));
}

export async function socialRestriction(accountId: string): Promise<SocialRestriction> {
  const [{ data }, minor] = await Promise.all([
    createAdminSupabaseClient().from("accounts").select("social_banned_at").eq("id", accountId).maybeSingle(),
    isMinorAccount(accountId),
  ]);
  if (data?.social_banned_at) return "banned";
  return minor ? "minor" : null;
}

export async function isSocialBanned(accountId: string): Promise<boolean> {
  return (await socialRestriction(accountId)) !== null;
}

export async function socialBlocked(accountId: string): Promise<ActionState | null> {
  const restriction = await socialRestriction(accountId);
  if (!restriction) return null;
  return { ok: false, error: restriction === "minor" ? SOCIAL_MINOR_ERROR : SOCIAL_BANNED_ERROR };
}
