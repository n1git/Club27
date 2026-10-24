import { createServerSupabaseClient } from "@/lib/supabase/server";
import { peopleMap, type Person } from "@/lib/data/social";
import { signPaths } from "@/lib/media/post-media";

export interface StoryItem {
  id: string;
  url: string;
  width: number;
  height: number;
  caption: string | null;
  createdAt: string;
  seen: boolean;
  viewCount: number;
}

export interface StoryGroup {
  person: Person;
  mine: boolean;
  stories: StoryItem[];
  unseen: boolean;
  latestAt: string;
}

type Row = {
  story_id: string;
  account_id: string;
  path: string;
  width: number;
  height: number;
  caption: string | null;
  created_at: string;
  seen: boolean;
};

export async function getStoryTray(accountId: string): Promise<StoryGroup[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("story_tray");
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const own = rows.filter((r) => r.account_id === accountId).map((r) => r.story_id);
  const [people, urls, views] = await Promise.all([
    peopleMap(rows.map((r) => r.account_id)),
    signPaths(rows.map((r) => r.path)),
    own.length ? supabase.from("story_views").select("story_id").in("story_id", own) : null,
  ]);
  const viewCount = new Map<string, number>();
  for (const v of views?.data ?? []) viewCount.set(v.story_id as string, (viewCount.get(v.story_id as string) ?? 0) + 1);

  const byAccount = new Map<string, StoryItem[]>();
  for (const r of [...rows].reverse()) {
    const url = urls.get(r.path);
    if (!url) continue;
    const list = byAccount.get(r.account_id) ?? [];
    list.push({ id: r.story_id, url, width: r.width, height: r.height, caption: r.caption, createdAt: r.created_at, seen: r.seen, viewCount: viewCount.get(r.story_id) ?? 0 });
    byAccount.set(r.account_id, list);
  }
  const groups: StoryGroup[] = [];
  for (const [id, stories] of byAccount) {
    const person = people.get(id);
    if (!person) continue;
    groups.push({ person, mine: id === accountId, stories, unseen: stories.some((s) => !s.seen), latestAt: stories[stories.length - 1].createdAt });
  }
  return groups.sort((a, b) => Number(b.mine) - Number(a.mine) || Number(b.unseen) - Number(a.unseen) || b.latestAt.localeCompare(a.latestAt));
}
