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

export interface PersonalRecord {
  sport: string;
  year: number;
  longestDistance: { meters: number; on: string } | null;
  longestDuration: { minutes: number; on: string } | null;
  bestPace: { minPerKm: number; on: string } | null;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  earnedOn: string;
}

type InsightLog = { performed_on: string; sport: string; duration_min: number; distance_m: number | null };

export function computeStreak(logs: { performedOn: string }[], goal: number | null, today: string): number {
  if (!goal) return 0;
  const counts = new Map<string, number>();
  for (const log of logs) {
    const week = weekStartOf(log.performedOn);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const current = weekStartOf(today);
  let streak = 0;
  for (let i = 0; i <= 260; i++) {
    const met = (counts.get(addDays(current, -7 * i)) ?? 0) >= goal;
    if (met) streak += 1;
    else if (i > 0) break;
  }
  return streak;
}

export function computeRecords(logs: InsightLog[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>();
  for (const log of logs) {
    const year = Number(log.performed_on.slice(0, 4));
    const key = `${log.sport}:${year}`;
    const rec = map.get(key) ?? { sport: log.sport, year, longestDistance: null, longestDuration: null, bestPace: null };
    if (!rec.longestDuration || log.duration_min > rec.longestDuration.minutes) rec.longestDuration = { minutes: log.duration_min, on: log.performed_on };
    if (log.distance_m) {
      if (!rec.longestDistance || log.distance_m > rec.longestDistance.meters) rec.longestDistance = { meters: log.distance_m, on: log.performed_on };
      const pace = log.duration_min / (log.distance_m / 1000);
      if (!rec.bestPace || pace < rec.bestPace.minPerKm) rec.bestPace = { minPerKm: pace, on: log.performed_on };
    }
    map.set(key, rec);
  }
  return [...map.values()].sort((a, b) => b.year - a.year || a.sport.localeCompare(b.sport));
}

export async function getWorkoutInsights(weeklyGoal: number | null) {
  const supabase = await createServerSupabaseClient();
  const today = getJakartaDateString();
  const [logs, earned] = await Promise.all([
    supabase.from("workout_logs").select("performed_on, sport, duration_min, distance_m").order("performed_on", { ascending: false }).limit(10000),
    supabase
      .from("achievements")
      .select("id, code, earned_on, achievement_types(name, description, sort_order)")
      .order("earned_on", { ascending: false })
      .limit(200),
  ]);
  const rows = (logs.data ?? []) as InsightLog[];
  const achievements: Achievement[] = (earned.data ?? []).map((a) => {
    const t = (Array.isArray(a.achievement_types) ? a.achievement_types[0] : a.achievement_types) as { name: string; description: string } | null;
    return { id: a.id as string, code: a.code as string, name: t?.name ?? (a.code as string), description: t?.description ?? "", earnedOn: a.earned_on as string };
  });
  return {
    streak: computeStreak(rows.map((r) => ({ performedOn: r.performed_on })), weeklyGoal, today),
    records: computeRecords(rows),
    achievements,
  };
}
