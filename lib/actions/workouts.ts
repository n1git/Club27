"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { socialLimited } from "@/lib/auth/social-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { weeklyGoalSchema, workoutSchema } from "@/lib/validations/workout";
import { type ActionState } from "./types";

const PATH = "/workouts";

export async function addWorkout(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "workout", 60);
  if (limited) return limited;
  const parsed = workoutSchema.safeParse({
    sport: formData.get("sport"),
    performedOn: formData.get("performedOn"),
    durationMin: formData.get("durationMin"),
    distanceM: formData.get("distanceM"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("workout_logs").insert({
    sport: parsed.data.sport,
    performed_on: parsed.data.performedOn,
    duration_min: parsed.data.durationMin,
    distance_m: parsed.data.distanceM ?? null,
    notes: parsed.data.notes || null,
  });
  if (error) {
    if (error.code === "WL001" || error.code === "WL002" || error.code === "WL003") return { ok: false, error: error.message };
    return { ok: false, error: "Gagal menyimpan catatan latihan" };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteWorkout(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("workout_logs").delete().eq("id", String(formData.get("workoutId"))).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menghapus catatan latihan" };
  revalidatePath(PATH);
  return { ok: true };
}

export async function setWeeklyGoal(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const parsed = weeklyGoalSchema.safeParse({ weeklySessions: formData.get("weeklySessions") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("workout_goals")
    .upsert({ account_id: session.account_id, weekly_sessions: parsed.data.weeklySessions });
  if (error) return { ok: false, error: "Gagal menyimpan target" };
  revalidatePath(PATH);
  return { ok: true };
}
