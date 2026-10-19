import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface Person {
  id: string;
  username: string;
  fullName: string;
}

export interface FeedComment {
  id: string;
  author: Person | null;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface FeedPost {
  id: string;
  author: Person | null;
  mine: boolean;
  kind: "text" | "workout";
  body: string | null;
  sport: string | null;
  performedOn: string | null;
  durationMin: number | null;
  distanceM: number | null;
  createdAt: string;
  kudos: { count: number; given: boolean; names: string[]; others: number };
  comments: FeedComment[];
}

export const FEED_PAGE = 20;

type PersonRow = { id: string; username: string; full_name: string };

async function peopleMap(ids: string[]): Promise<Map<string, Person>> {
  if (!ids.length) return new Map();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("social_people").select("id, username, full_name").in("id", [...new Set(ids)]);
  return new Map(((data ?? []) as PersonRow[]).map((p) => [p.id, { id: p.id, username: p.username, fullName: p.full_name }]));
}

export async function getFeed(accountId: string, before?: string): Promise<{ posts: FeedPost[]; hasMore: boolean }> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("posts")
    .select("id, account_id, kind, body, sport, performed_on, duration_min, distance_m, created_at")
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE + 1);
  if (before) query = query.lt("created_at", before);
  const { data } = await query;
  const rows = data ?? [];
  const hasMore = rows.length > FEED_PAGE;
  const page = rows.slice(0, FEED_PAGE);
  if (!page.length) return { posts: [], hasMore: false };
  const ids = page.map((p) => p.id as string);
  const [reactions, comments] = await Promise.all([
    supabase.rpc("kudos_for_posts", { p_posts: ids }),
    supabase.from("post_comments").select("id, post_id, account_id, body, created_at").in("post_id", ids).order("created_at").limit(2000),
  ]);
  const people = await peopleMap([...page.map((p) => p.account_id as string), ...(comments.data ?? []).map((c) => c.account_id as string)]);
  return {
    hasMore,
    posts: page.map((p) => {
      const givers = ((reactions.data ?? []) as { post_id: string; username: string | null; full_name: string | null; is_me: boolean }[]).filter((r) => r.post_id === p.id);
      const names = givers.filter((r) => !r.is_me && r.full_name).map((r) => r.full_name as string);
      const given = givers.some((r) => r.is_me);
      return {
        id: p.id as string,
        author: people.get(p.account_id as string) ?? null,
        mine: p.account_id === accountId,
        kind: p.kind as "text" | "workout",
        body: p.body as string | null,
        sport: p.sport as string | null,
        performedOn: p.performed_on as string | null,
        durationMin: p.duration_min as number | null,
        distanceM: p.distance_m as number | null,
        createdAt: p.created_at as string,
        kudos: { count: givers.length, given, names: names.slice(0, 3), others: givers.length - (given ? 1 : 0) - Math.min(names.length, 3) },
        comments: (comments.data ?? [])
          .filter((c) => c.post_id === p.id)
          .map((c) => ({
            id: c.id as string,
            author: people.get(c.account_id as string) ?? null,
            body: c.body as string,
            createdAt: c.created_at as string,
            mine: c.account_id === accountId,
          })),
      };
    }),
  };
}

export interface FriendLists {
  friends: { friendshipId: string; person: Person }[];
  incoming: { friendshipId: string; person: Person }[];
  outgoing: { friendshipId: string; person: Person }[];
  blocked: Person[];
}

export async function getFriendLists(accountId: string): Promise<FriendLists> {
  const supabase = await createServerSupabaseClient();
  const [friendships, blocks] = await Promise.all([
    supabase.from("friendships").select("id, requester_id, addressee_id, status").limit(1000),
    supabase.from("blocks").select("blocked_id").limit(1000),
  ]);
  const rows = friendships.data ?? [];
  const blockedIds = (blocks.data ?? []).map((b) => b.blocked_id as string);
  const people = await peopleMap([...rows.flatMap((r) => [r.requester_id as string, r.addressee_id as string]), ...blockedIds]);
  const other = (r: { requester_id: string; addressee_id: string }) => people.get(r.requester_id === accountId ? r.addressee_id : r.requester_id);
  const lists: FriendLists = { friends: [], incoming: [], outgoing: [], blocked: [] };
  for (const r of rows) {
    const person = other(r as { requester_id: string; addressee_id: string });
    if (!person) continue;
    const entry = { friendshipId: r.id as string, person };
    if (r.status === "accepted") lists.friends.push(entry);
    else if (r.addressee_id === accountId) lists.incoming.push(entry);
    else lists.outgoing.push(entry);
  }
  lists.blocked = blockedIds.map((id) => people.get(id)).filter((p): p is Person => Boolean(p));
  lists.friends.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
  return lists;
}

export async function getSocialBadges(accountId: string): Promise<{ friends: number; groups: number }> {
  const supabase = await createServerSupabaseClient();
  const [friends, groups] = await Promise.all([
    supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", accountId).eq("status", "pending"),
    supabase.from("group_members").select("group_id", { count: "exact", head: true }).eq("account_id", accountId).eq("status", "invited"),
  ]);
  return { friends: friends.count ?? 0, groups: groups.count ?? 0 };
}
