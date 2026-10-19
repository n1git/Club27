"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { socialBlocked } from "@/lib/auth/social-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionState } from "./types";

const schema = z.object({ clubId: z.string().uuid(), on: z.enum(["0", "1"]) });

export async function setLeaderboardOptin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole(["personal", "member"]);
  const parsed = schema.safeParse({ clubId: formData.get("clubId"), on: formData.get("on") });
  if (!parsed.success) return { ok: false, error: "Data tidak valid" };
  if (parsed.data.on === "1") {
    const blocked = await socialBlocked(session.account_id);
    if (blocked) return blocked;
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_leaderboard_optin", { p_club: parsed.data.clubId, p_on: parsed.data.on === "1" });
  if (error) return { ok: false, error: "Gagal menyimpan pengaturan peringkat" };
  revalidatePath("/home/join-club");
  revalidatePath("/member/leaderboard");
  return { ok: true, message: parsed.data.on === "1" ? "Total latihan Anda tampil di peringkat klub" : "Anda tidak lagi tampil di peringkat klub" };
}
