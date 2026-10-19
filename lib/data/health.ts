import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJakartaDateString } from "@/lib/format";

export interface Measurement {
  id: string;
  measuredOn: string;
  heightCm: number | null;
  weightKg: number | null;
}

export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (heightCm == null || weightKg == null) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function healthSummary(rows: Measurement[]) {
  const latestWeight = rows.find((r) => r.weightKg != null) ?? null;
  const latestFull = rows.find((r) => r.heightCm != null && r.weightKg != null) ?? null;
  return {
    latestWeight,
    bmi: latestFull ? bmi(latestFull.heightCm, latestFull.weightKg) : null,
    bmiOn: latestFull?.measuredOn ?? null,
  };
}

export async function getHealthData() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("body_measurements")
    .select("id, measured_on, height_cm, weight_kg")
    .order("measured_on", { ascending: false })
    .limit(500);
  const rows: Measurement[] = (data ?? []).map((r) => ({
    id: r.id as string,
    measuredOn: r.measured_on as string,
    heightCm: r.height_cm == null ? null : Number(r.height_cm),
    weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
  }));
  return { rows, summary: healthSummary(rows), today: getJakartaDateString() };
}
