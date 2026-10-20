"use server";

import { redirect } from "next/navigation";
import { requireActionRole } from "@/lib/auth/guard";
import { clearSession } from "@/lib/auth/session";
import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { verifyReauth } from "@/lib/auth/reauth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { type ActionState } from "./types";

export async function deleteOwnAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  if (String(formData.get("confirmText") ?? "").trim() !== "HAPUS") return { ok: false, error: "Ketik HAPUS untuk mengonfirmasi" };
  if (await isKeyRateLimited(`account-delete:${session.account_id}`, 5, 3600, true)) return { ok: false, error: RATE_LIMIT_ERROR };
  const reauth = await verifyReauth(session.account_id, formData.get("confirmPassword"));
  if (reauth) return { ok: false, error: reauth };

  const supabase = createAdminSupabaseClient();
  const [{ count: profiles }, { count: owners }] = await Promise.all([
    supabase.from("club_profiles").select("id", { count: "exact", head: true }).eq("account_id", session.account_id),
    supabase.from("organization_users").select("id", { count: "exact", head: true }).eq("account_id", session.account_id),
  ]);
  if (profiles || owners) {
    return {
      ok: false,
      error: "Akun ini masih terhubung ke klub atau organisasi. Minta klub menghapus data keanggotaan Anda, atau hapus organisasi Anda lebih dulu.",
    };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", session.account_id);
  if (error) return { ok: false, error: "Akun tidak bisa dihapus. Hubungi admin platform." };
  await supabase
    .from("consents")
    .update({ revoked_at: new Date().toISOString(), guardian_name: null })
    .eq("subject_type", "account")
    .eq("subject_id", session.account_id)
    .is("revoked_at", null);
  await logAudit({ action: "account.delete", targetType: "account", targetId: session.account_id, actorRole: "personal" });
  await clearSession();
  redirect("/");
}
