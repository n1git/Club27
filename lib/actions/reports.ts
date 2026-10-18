"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { revokeAccountSessions } from "@/lib/accounts/account";
import { logAudit } from "@/lib/audit";
import { type ActionState } from "./types";

const TABLES = { post: "posts", comment: "post_comments", group: "groups", event: "events" } as const;
const AUTHOR = { post: "account_id", comment: "account_id", group: "owner_id", event: "created_by" } as const;

const resolveSchema = z.object({ reportId: z.string().uuid(), action: z.enum(["dismiss", "remove", "suspend"]) });
const reactivateSchema = z.object({ accountId: z.string().uuid() });

async function superadminOrNull() {
  try {
    return await requireSuperadminAction();
  } catch {
    return null;
  }
}

const SESSION_ENDED: ActionState = { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };

export async function resolveReport(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const parsed = resolveSchema.safeParse({ reportId: formData.get("reportId"), action: formData.get("action") });
  if (!parsed.success) return { ok: false, error: "Data tidak valid" };
  const supabase = createAdminSupabaseClient();
  const { data: report } = await supabase.from("reports").select("id, target_type, target_id, status").eq("id", parsed.data.reportId).maybeSingle();
  if (!report || report.status !== "open") return { ok: false, error: "Laporan tidak ditemukan atau sudah ditinjau" };
  const type = report.target_type as keyof typeof TABLES | "account";
  const targetId = report.target_id as string;

  let status: "dismissed" | "removed" | "suspended" = "dismissed";
  if (parsed.data.action === "remove") {
    if (type === "account") return { ok: false, error: "Akun tidak bisa dihapus dari sini. Pilih nonaktifkan." };
    const { error } = await supabase.from(TABLES[type]).delete().eq("id", targetId);
    if (error) return { ok: false, error: "Gagal menghapus konten" };
    status = "removed";
  }
  if (parsed.data.action === "suspend") {
    let accountId: string | null = targetId;
    if (type !== "account") {
      const { data: row } = await supabase.from(TABLES[type]).select(AUTHOR[type]).eq("id", targetId).maybeSingle();
      accountId = row ? ((row as unknown as Record<string, string>)[AUTHOR[type]] ?? null) : null;
    }
    if (!accountId) return { ok: false, error: "Konten sudah dihapus, penulisnya tidak diketahui" };
    const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", accountId);
    if (error) return { ok: false, error: "Gagal menonaktifkan akun" };
    await revokeAccountSessions(accountId);
    status = "suspended";
  }

  await supabase
    .from("reports")
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: superadmin.id })
    .eq("target_type", type)
    .eq("target_id", targetId)
    .eq("status", "open");
  await logAudit({
    action: `report.${status}`,
    targetType: type,
    targetId,
    details: { report: report.id },
    actorId: superadmin.id,
    actorRole: "superadmin",
    actorLabel: superadmin.email,
  });
  revalidatePath("/superadmin/laporan");
  return { ok: true, message: { dismissed: "Laporan diabaikan", removed: "Konten dihapus", suspended: "Akun dinonaktifkan" }[status] };
}

export async function reactivateAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const parsed = reactivateSchema.safeParse({ accountId: formData.get("accountId") });
  if (!parsed.success) return { ok: false, error: "Data tidak valid" };
  const { error } = await createAdminSupabaseClient().from("accounts").update({ is_active: true }).eq("id", parsed.data.accountId);
  if (error) return { ok: false, error: "Gagal mengaktifkan akun" };
  await logAudit({
    action: "account.reactivate",
    targetType: "account",
    targetId: parsed.data.accountId,
    actorId: superadmin.id,
    actorRole: "superadmin",
    actorLabel: superadmin.email,
  });
  revalidatePath("/superadmin/laporan");
  return { ok: true, message: "Akun diaktifkan kembali" };
}
