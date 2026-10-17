import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJakartaDateString, getJakartaDayRangeIso, parseJakartaLocalInput } from "@/lib/format";

export interface CheckinRow {
  id: string;
  checkedInAt: string;
  method: "qr" | "manual";
  memberName: string;
  pointName: string | null;
  planName: string | null;
}

export interface CheckinPoint {
  id: string;
  name: string;
  isActive: boolean;
  locationName: string | null;
}

export interface CheckinOverview {
  today: CheckinRow[];
  points: CheckinPoint[];
  visitsToday: number;
  visitsWeek: number;
  hourly: { hour: string; visits: number }[];
  dormant: { memberId: string; fullName: string; lastCheckinAt: string | null }[];
}

interface RawCheckin {
  id: string;
  checked_in_at: string;
  method: "qr" | "manual";
  members: { full_name: string } | null;
  checkin_points: { name: string } | null;
  subscriptions: { membership_packages: { name: string } | null } | null;
}

const CHECKIN_SELECT =
  "id, checked_in_at, method, members:club_members(full_name), checkin_points(name), subscriptions:member_memberships(membership_packages(name))";

function toRow(raw: RawCheckin): CheckinRow {
  return {
    id: raw.id,
    checkedInAt: raw.checked_in_at,
    method: raw.method,
    memberName: raw.members?.full_name ?? "-",
    pointName: raw.checkin_points?.name ?? null,
    planName: raw.subscriptions?.membership_packages?.name ?? null,
  };
}

export async function getCheckinOverview(): Promise<CheckinOverview> {
  const supabase = await createServerSupabaseClient();
  const { start, end } = getJakartaDayRangeIso();

  const [{ data: today }, { data: points }, { data: counts }, { data: hourly }, { data: dormant }] = await Promise.all([
    supabase
      .from("checkins")
      .select(CHECKIN_SELECT)
      .gte("checked_in_at", start)
      .lt("checked_in_at", end)
      .order("checked_in_at", { ascending: false }),
    supabase.from("checkin_points").select("id, name, is_active, locations(name)").order("name"),
    supabase.from("checkin_daily_counts").select("visits_today, visits_week").maybeSingle(),
    supabase.from("checkin_hourly_30d").select("hour, visits").order("hour"),
    supabase
      .from("dormant_members")
      .select("member_id, full_name, last_checkin_at")
      .order("last_checkin_at", { ascending: true, nullsFirst: true })
      .limit(50),
  ]);

  return {
    today: ((today ?? []) as unknown as RawCheckin[]).map(toRow),
    points: (points ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      isActive: p.is_active as boolean,
      locationName: (p.locations as unknown as { name: string } | null)?.name ?? null,
    })),
    visitsToday: Number(counts?.visits_today ?? 0),
    visitsWeek: Number(counts?.visits_week ?? 0),
    hourly: (hourly ?? []).map((h) => ({
      hour: `${String(h.hour).padStart(2, "0")}:00`,
      visits: Number(h.visits),
    })),
    dormant: (dormant ?? []).map((d) => ({
      memberId: d.member_id as string,
      fullName: d.full_name as string,
      lastCheckinAt: (d.last_checkin_at as string | null) ?? null,
    })),
  };
}

export interface VisitHistory {
  rows: CheckinRow[];
  visitsThisMonth: number;
}

export async function getVisitHistory(memberId?: string): Promise<VisitHistory> {
  const supabase = await createServerSupabaseClient();
  const monthStart = parseJakartaLocalInput(`${getJakartaDateString().slice(0, 7)}-01T00:00`);

  let rowsQuery = supabase.from("checkins").select(CHECKIN_SELECT).order("checked_in_at", { ascending: false }).limit(50);
  let countQuery = supabase.from("checkins").select("id", { count: "exact", head: true }).gte("checked_in_at", monthStart);
  if (memberId) {
    rowsQuery = rowsQuery.eq("member_id", memberId);
    countQuery = countQuery.eq("member_id", memberId);
  }
  const [{ data }, { count }] = await Promise.all([rowsQuery, countQuery]);

  return { rows: ((data ?? []) as unknown as RawCheckin[]).map(toRow), visitsThisMonth: count ?? 0 };
}

export async function getCheckinById(id: string): Promise<CheckinRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("checkins").select(CHECKIN_SELECT).eq("id", id).maybeSingle();
  return data ? toRow(data as unknown as RawCheckin) : null;
}

export async function getCheckinPointName(pointId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("checkin_points").select("name, is_active").eq("id", pointId).maybeSingle();
  return data?.is_active ? (data.name as string) : null;
}
