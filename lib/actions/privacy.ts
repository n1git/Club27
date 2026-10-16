"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type ActionState } from "./types";

const schema = z.object({
  memberId: z.string().uuid("Anggota tidak valid"),
  reason: z.string().trim().min(5, "Tulis alasan, minimal 5 karakter").max(500, "Alasan terlalu panjang"),
  confirm: z.literal("ANONIMKAN", { message: "Ketik ANONIMKAN untuk mengonfirmasi" }),
});

export async function anonymiseMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("members.privacy");
  const parsed = schema.safeParse({
    memberId: formData.get("memberId"),
    reason: formData.get("reason"),
    confirm: String(formData.get("confirm") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("anonymise_member", {
    p_member_id: parsed.data.memberId,
    p_reason: parsed.data.reason,
    p_confirm: parsed.data.confirm,
  });
  if (error) return { ok: false, error: error.code?.startsWith("AN") ? error.message : "Gagal menganonimkan anggota" };

  revalidatePath("/admin/members");
  redirect("/admin/members");
}
