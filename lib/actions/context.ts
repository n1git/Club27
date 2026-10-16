"use server";

import { redirect } from "next/navigation";
import { checkSession, sessionEndedPath, UnauthorizedError } from "@/lib/auth/guard";
import { createSession, getSession } from "@/lib/auth/session";
import { listContexts, personalTarget } from "@/lib/auth/contexts";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ActionState } from "./types";

export async function switchContext(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));
  if (check.mustChangePassword) redirect("/change-password");

  const key = String(formData.get("key") ?? "");
  let target;
  if (key === "personal") {
    const { data: account } = await createAdminSupabaseClient()
      .from("accounts")
      .select("id, email, full_name")
      .eq("id", session.account_id)
      .maybeSingle();
    if (!account) throw new UnauthorizedError("Akun tidak ditemukan");
    target = personalTarget(account);
  } else {
    const entry = (await listContexts(session.account_id)).entries.find((e) => e.key === key);
    if (!entry) return { ok: false, error: "Konteks tidak ditemukan atau akses dinonaktifkan" };
    target = entry.target;
  }

  await createSession({
    id: target.profileId,
    accountId: session.account_id,
    email: target.email,
    fullName: target.fullName,
    role: target.role,
    tenantId: target.tenantId,
    orgId: target.orgId,
  });
  redirect(target.redirectTo);
}
