"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { socialBlocked } from "@/lib/auth/social-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionState } from "./types";

export async function markNotificationsRead(before: string): Promise<ActionState> {
  const session = await requireActionRole("personal");
  if (await socialBlocked(session.account_id)) return { ok: false };
  if (Number.isNaN(Date.parse(before))) return { ok: false };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("mark_notifications_read", { p_before: before });
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}
