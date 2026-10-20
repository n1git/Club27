import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { passwordResetEmail } from "@/lib/accounts/mail";
import { newToken } from "@/lib/accounts/tokens";

export const RESET_MINUTES = 60;

export async function createPasswordReset(
  account: { id: string; email: string; full_name: string },
  requestedBy: string | null = null
): Promise<{ link: string; emailSent: boolean } | null> {
  const supabase = createAdminSupabaseClient();
  const { token, hash } = newToken();
  const link = `${SITE_URL}/r/${token}`;
  const { data, error } = await supabase
    .from("password_resets")
    .insert({
      account_id: account.id,
      token_hash: hash,
      expires_at: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString(),
      requested_by: requestedBy,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  let emailSent = false;
  if (isEmailConfigured()) {
    emailSent = await sendEmail({ to: account.email, ...passwordResetEmail({ link, name: account.full_name }) });
    if (emailSent) await supabase.from("password_resets").update({ delivered: true }).eq("id", data.id);
  }
  return { link, emailSent };
}
