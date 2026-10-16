"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type ActionState } from "./types";

const schema = z.object({
  module: z.string().regex(/^[a-z_]{2,40}$/, "Modul tidak valid"),
  enabled: z.enum(["true", "false"]),
});

export async function setClubModule(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("club.settings");
  const parsed = schema.safeParse({ module: formData.get("module"), enabled: formData.get("enabled") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_club_module", {
    p_module: parsed.data.module,
    p_enabled: parsed.data.enabled === "true",
  });
  if (error) {
    return { ok: false, error: error.code === "MD001" ? error.message : "Gagal mengubah modul" };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: parsed.data.enabled === "true" ? "Modul diaktifkan" : "Modul dinonaktifkan" };
}
