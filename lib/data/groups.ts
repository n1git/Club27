import { createServerSupabaseClient } from "@/lib/supabase/server";
import { peopleMap, type Person } from "@/lib/data/social";

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  owner: Person | null;
  isOwner: boolean;
  status: "active" | "invited";
}

export interface GroupEvent {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  cancelled: boolean;
  finished: boolean;
  createdBy: string;
  going: number;
  maybe: number;
  mine: "going" | "maybe" | "declined" | null;
}

export async function getMyGroups(accountId: string): Promise<GroupSummary[]> {
  const supabase = await createServerSupabaseClient();
  const [{ data: memberships }, { data: groups }] = await Promise.all([
    supabase.from("group_members").select("group_id, status").eq("account_id", accountId).limit(200),
    supabase.from("groups").select("id, owner_id, name, description").order("created_at", { ascending: false }).limit(200),
  ]);
  const status = new Map((memberships ?? []).map((m) => [m.group_id as string, m.status as "active" | "invited"]));
  const owners = await peopleMap((groups ?? []).map((g) => g.owner_id as string));
  return (groups ?? [])
    .filter((g) => status.has(g.id as string))
    .map((g) => ({
      id: g.id as string,
      name: g.name as string,
      description: g.description as string | null,
      owner: owners.get(g.owner_id as string) ?? null,
      isOwner: g.owner_id === accountId,
      status: status.get(g.id as string)!,
    }));
}

export interface GroupDetail {
  group: GroupSummary;
  members: { person: Person | null; accountId: string; role: "owner" | "member"; status: "active" | "invited" }[];
  events: GroupEvent[];
  invitable: Person[];
}

export async function getGroupDetail(accountId: string, groupId: string, friends: Person[]): Promise<GroupDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data: g } = await supabase.from("groups").select("id, owner_id, name, description").eq("id", groupId).maybeSingle();
  if (!g) return null;
  const [{ data: members }, { data: events }] = await Promise.all([
    supabase.from("group_members").select("account_id, role, status").eq("group_id", groupId).limit(300),
    supabase.from("events").select("id, group_id, created_by, title, description, location, starts_at, ends_at, capacity, cancelled_at").eq("group_id", groupId).order("starts_at").limit(200),
  ]);
  const eventIds = (events ?? []).map((e) => e.id as string);
  const { data: rsvps } = eventIds.length
    ? await supabase.from("event_rsvps").select("event_id, account_id, status").in("event_id", eventIds).limit(10000)
    : { data: [] };
  const names = await peopleMap([g.owner_id as string, ...(members ?? []).map((m) => m.account_id as string)]);
  const mine = (members ?? []).find((m) => m.account_id === accountId);
  const taken = new Set((members ?? []).map((m) => m.account_id as string));
  return {
    group: {
      id: g.id as string,
      name: g.name as string,
      description: g.description as string | null,
      owner: names.get(g.owner_id as string) ?? null,
      isOwner: g.owner_id === accountId,
      status: (mine?.status as "active" | "invited" | undefined) ?? "invited",
    },
    members: (members ?? []).map((m) => ({
      person: names.get(m.account_id as string) ?? null,
      accountId: m.account_id as string,
      role: m.role as "owner" | "member",
      status: m.status as "active" | "invited",
    })),
    events: (events ?? []).map((e) => {
      const list = (rsvps ?? []).filter((r) => r.event_id === e.id);
      return {
        id: e.id as string,
        groupId: e.group_id as string,
        title: e.title as string,
        description: e.description as string | null,
        location: e.location as string | null,
        startsAt: e.starts_at as string,
        endsAt: e.ends_at as string | null,
        capacity: e.capacity as number | null,
        cancelled: Boolean(e.cancelled_at),
        finished: new Date((e.ends_at ?? e.starts_at) as string).getTime() <= Date.now(),
        createdBy: e.created_by as string,
        going: list.filter((r) => r.status === "going").length,
        maybe: list.filter((r) => r.status === "maybe").length,
        mine: (list.find((r) => r.account_id === accountId)?.status as GroupEvent["mine"] | undefined) ?? null,
      };
    }),
    invitable: friends.filter((f) => !taken.has(f.id)),
  };
}

export async function getUpcomingEvents(limit = 5): Promise<(GroupEvent & { groupName: string })[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("events")
    .select("id, group_id, created_by, title, description, location, starts_at, ends_at, capacity, cancelled_at, groups(name)")
    .is("cancelled_at", null)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(limit);
  return (data ?? []).map((e) => {
    const group = e.groups as unknown as { name: string } | { name: string }[] | null;
    return {
      id: e.id as string,
      groupId: e.group_id as string,
      groupName: (Array.isArray(group) ? group[0]?.name : group?.name) ?? "Grup",
      title: e.title as string,
      description: e.description as string | null,
      location: e.location as string | null,
      startsAt: e.starts_at as string,
      endsAt: e.ends_at as string | null,
      capacity: e.capacity as number | null,
      cancelled: false,
      finished: false,
      createdBy: e.created_by as string,
      going: 0,
      maybe: 0,
      mine: null,
    };
  });
}
