"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type ActionState } from "./types";

export async function completeOnboarding(): Promise<ActionState> {
  await requireActionPermission("club.settings");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("complete_onboarding");
  if (error) return { ok: false, error: "Gagal menyelesaikan penyiapan" };
  revalidatePath("/admin", "layout");
  redirect("/admin");
}
