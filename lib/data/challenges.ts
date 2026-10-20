import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ChallengeMetric = "sessions" | "distance" | "duration";

export interface Challenge {
  id: string;
  name: string;
  metric: ChallengeMetric;
  target: number;
  sport: string | null;
  startsOn: string;
  endsOn: string;
  groupId: string | null;
  clubId: string | null;
  scopeName: string;
}

export interface ChallengeProgressRow {
  rank: number;
  accountId: string;
  username: string;
  fullName: string;
  value: number;
  isMe: boolean;
  done: boolean;
}

export const METRIC_NAME: Record<ChallengeMetric, string> = { sessions: "Sesi", distance: "Jarak", duration: "Durasi" };

export function formatChallengeValue(value: number, metric: ChallengeMetric) {
  if (metric === "distance") return value >= 1000 ? `${(value / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km` : `${value} m`;
  if (metric === "duration") return `${value} menit`;
  return `${value} sesi`;
}

type Raw = {
  id: string;
  name: string;
  metric: ChallengeMetric;
  target: number;
  sport: string | null;
  starts_on: string;
  ends_on: string;
  group_id: string | null;
  club_id: string | null;
  groups: { name: string } | { name: string }[] | null;
};

async function withScope(rows: Raw[]): Promise<Challenge[]> {
  const clubIds = [...new Set(rows.map((r) => r.club_id).filter(Boolean))] as string[];
  const clubNames = new Map<string, string>();
  if (clubIds.length) {
    const { data } = await createAdminSupabaseClient().from("clubs").select("id, name").in("id", clubIds);
    for (const c of data ?? []) clubNames.set(c.id as string, c.name as string);
  }
  return rows.map((r) => {
    const group = Array.isArray(r.groups) ? r.groups[0] : r.groups;
    return {
      id: r.id,
      name: r.name,
      metric: r.metric,
      target: r.target,
      sport: r.sport,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      groupId: r.group_id,
      clubId: r.club_id,
      scopeName: r.group_id ? (group?.name ?? "Grup") : (clubNames.get(r.club_id ?? "") ?? "Klub"),
    };
  });
}

const SELECT = "id, name, metric, target, sport, starts_on, ends_on, group_id, club_id, groups(name)";

export async function listVisibleChallenges(clubId?: string): Promise<Challenge[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("challenges").select(SELECT).order("ends_on", { ascending: false }).limit(100);
  if (clubId) query = query.eq("club_id", clubId);
  const { data } = await query;
  return withScope((data ?? []) as unknown as Raw[]);
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("challenges").select(SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await withScope([data as unknown as Raw]))[0];
}

export async function getChallengeProgress(id: string): Promise<ChallengeProgressRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("challenge_progress", { p_id: id });
  return ((data ?? []) as { rank: number; account_id: string; username: string; full_name: string; value: number | string; is_me: boolean; done: boolean }[]).map((r) => ({
    rank: r.rank,
    accountId: r.account_id,
    username: r.username,
    fullName: r.full_name,
    value: Number(r.value),
    isMe: r.is_me,
    done: r.done,
  }));
}

export async function getMyChallengeState(accountId: string) {
  const supabase = await createServerSupabaseClient();
  const [joined, owned] = await Promise.all([
    supabase.from("challenge_participants").select("challenge_id").eq("account_id", accountId),
    supabase.from("groups").select("id, name").eq("owner_id", accountId).order("name"),
  ]);
  return {
    joined: new Set((joined.data ?? []).map((r) => r.challenge_id as string)),
    ownedGroups: (owned.data ?? []) as { id: string; name: string }[],
  };
}
