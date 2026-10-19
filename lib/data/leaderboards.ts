import { createServerSupabaseClient } from "@/lib/supabase/server";

export type BoardMetric = "distance" | "duration" | "sessions";
export type BoardPeriod = "week" | "month";

export interface BoardRow {
  rank: number;
  accountId: string;
  username: string;
  fullName: string;
  sessions: number;
  distanceM: number;
  durationMin: number;
  isMe: boolean;
}

export interface BoardParams {
  metric: BoardMetric;
  period: BoardPeriod;
  sport: string | null;
}

export const BOARD_SIZE = 10;

const METRIC_QUERY: Record<string, BoardMetric> = { jarak: "distance", durasi: "duration", sesi: "sessions" };
const PERIOD_QUERY: Record<string, BoardPeriod> = { minggu: "week", bulan: "month" };

export function parseBoardParams(query: { metrik?: string; periode?: string; olahraga?: string }): BoardParams {
  return {
    metric: METRIC_QUERY[query.metrik ?? ""] ?? "distance",
    period: PERIOD_QUERY[query.periode ?? ""] ?? "week",
    sport: query.olahraga && /^[a-z_]{2,30}$/.test(query.olahraga) ? query.olahraga : null,
  };
}

export const METRIC_LABEL: Record<BoardMetric, string> = { distance: "Jarak", duration: "Durasi", sessions: "Sesi" };
export const PERIOD_LABEL: Record<BoardPeriod, string> = { week: "Minggu ini", month: "Bulan ini" };
export const METRIC_KEY: Record<BoardMetric, string> = { distance: "jarak", duration: "durasi", sessions: "sesi" };
export const PERIOD_KEY: Record<BoardPeriod, string> = { week: "minggu", month: "bulan" };

type RawRow = {
  rank: number;
  account_id: string;
  username: string;
  full_name: string;
  sessions: number;
  distance_m: number | string;
  duration_min: number | string;
  is_me: boolean;
};

function toRows(data: RawRow[] | null): BoardRow[] {
  return (data ?? []).map((r) => ({
    rank: r.rank,
    accountId: r.account_id,
    username: r.username,
    fullName: r.full_name,
    sessions: r.sessions,
    distanceM: Number(r.distance_m),
    durationMin: Number(r.duration_min),
    isMe: r.is_me,
  }));
}

export async function getGroupBoard(groupId: string, params: BoardParams): Promise<BoardRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("group_leaderboard", {
    p_group: groupId,
    p_metric: params.metric,
    p_period: params.period,
    p_sport: params.sport,
  });
  return toRows(data as RawRow[] | null);
}

export async function getClubBoard(clubId: string, params: BoardParams): Promise<BoardRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("club_leaderboard", {
    p_club: clubId,
    p_metric: params.metric,
    p_period: params.period,
    p_sport: params.sport,
  });
  return toRows(data as RawRow[] | null);
}

export interface BoardClub {
  clubId: string;
  clubName: string;
  optedIn: boolean;
}

export async function getMyBoardClubs(): Promise<BoardClub[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("my_leaderboard_clubs");
  return ((data as { club_id: string; club_name: string; opted_in: boolean }[] | null) ?? []).map((r) => ({
    clubId: r.club_id,
    clubName: r.club_name,
    optedIn: r.opted_in,
  }));
}
