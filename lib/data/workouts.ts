import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJakartaDateString } from "@/lib/format";

export interface WorkoutLog {
  id: string;
  sport: string;
  performedOn: string;
  durationMin: number;
  distanceM: number | null;
  notes: string | null;
}

export interface WeekSummary {
  weekStart: string;
  sessions: number;
  minutes: number;
  distanceM: number;
}

const WEEKS = 4;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekStartOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function summarizeWeeks(logs: Pick<WorkoutLog, "performedOn" | "durationMin" | "distanceM">[], today: string): WeekSummary[] {
  const current = weekStartOf(today);
  const weeks: WeekSummary[] = Array.from({ length: WEEKS }, (_, i) => ({
    weekStart: addDays(current, -7 * (WEEKS - 1 - i)),
    sessions: 0,
    minutes: 0,
    distanceM: 0,
  }));
  for (const log of logs) {
    const week = weeks.find((w) => w.weekStart === weekStartOf(log.performedOn));
    if (!week) continue;
    week.sessions += 1;
    week.minutes += log.durationMin;
    week.distanceM += log.distanceM ?? 0;
  }
  return weeks;
}

export async function getWorkoutData() {
  const supabase = await createServerSupabaseClient();
  const today = getJakartaDateString();
  const since = addDays(weekStartOf(today), -7 * (WEEKS - 1));
  const [recent, window, goal] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("id, sport, performed_on, duration_min, distance_m, notes")
      .order("performed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("workout_logs").select("performed_on, duration_min, distance_m").gte("performed_on", since).limit(2000),
    supabase.from("workout_goals").select("weekly_sessions").maybeSingle(),
  ]);
  const map = (row: { id: string; sport: string; performed_on: string; duration_min: number; distance_m: number | null; notes: string | null }): WorkoutLog => ({
    id: row.id,
    sport: row.sport,
    performedOn: row.performed_on,
    durationMin: row.duration_min,
    distanceM: row.distance_m,
    notes: row.notes,
  });
  return {
    logs: (recent.data ?? []).map(map),
    weeks: summarizeWeeks(
      (window.data ?? []).map((r) => ({ performedOn: r.performed_on as string, durationMin: r.duration_min as number, distanceM: r.distance_m as number | null })),
      today
    ),
    weeklyGoal: (goal.data?.weekly_sessions as number | undefined) ?? null,
    today,
  };
}
