import { createServerSupabaseClient } from "@/lib/supabase/server";
import { peopleMap, type Person } from "@/lib/data/social";
import { signPaths } from "@/lib/media/post-media";

export type NotificationType = "friend_request" | "friend_accepted" | "post_reaction" | "post_comment" | "group_invite";

export interface NotificationItem {
  key: string;
  type: NotificationType;
  actors: Person[];
  actorCount: number;
  postId: string | null;
  thumbUrl: string | null;
  commentBody: string | null;
  groupId: string | null;
  groupName: string | null;
  friendshipId: string | null;
  createdAt: string;
  unread: boolean;
}

type Row = {
  id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  group_id: string | null;
  read_at: string | null;
  created_at: string;
};

const LIMIT = 200;

export async function getUnreadCounts(): Promise<{ notifications: number; messages: number }> {
  const supabase = await createServerSupabaseClient();
  const [notifications, messages] = await Promise.all([supabase.rpc("unread_notification_count"), supabase.rpc("unread_message_count")]);
  return { notifications: Number(notifications.data ?? 0), messages: Number(messages.data ?? 0) };
}

export async function getNotifications(accountId: string): Promise<NotificationItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, actor_id, type, post_id, comment_id, group_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const postIds = [...new Set(rows.flatMap((r) => (r.post_id ? [r.post_id] : [])))];
  const commentIds = rows.flatMap((r) => (r.comment_id ? [r.comment_id] : []));
  const groupIds = [...new Set(rows.flatMap((r) => (r.group_id ? [r.group_id] : [])))];
  const [people, media, comments, groups, incoming] = await Promise.all([
    peopleMap(rows.map((r) => r.actor_id)),
    postIds.length ? supabase.from("post_media").select("post_id, path").in("post_id", postIds).eq("position", 0) : null,
    commentIds.length ? supabase.from("post_comments").select("id, body").in("id", commentIds) : null,
    groupIds.length ? supabase.from("groups").select("id, name").in("id", groupIds) : null,
    supabase.from("friendships").select("id, requester_id").eq("addressee_id", accountId).eq("status", "pending"),
  ]);
  const urls = await signPaths((media?.data ?? []).map((m) => m.path as string));
  const thumbs = new Map((media?.data ?? []).map((m) => [m.post_id as string, urls.get(m.path as string) ?? null]));
  const commentBody = new Map((comments?.data ?? []).map((c) => [c.id as string, c.body as string]));
  const groupName = new Map((groups?.data ?? []).map((g) => [g.id as string, g.name as string]));
  const friendship = new Map((incoming.data ?? []).map((f) => [f.requester_id as string, f.id as string]));

  const items: NotificationItem[] = [];
  const reactionItems = new Map<string, NotificationItem>();
  for (const r of rows) {
    const actor = people.get(r.actor_id);
    const base = {
      postId: r.post_id,
      thumbUrl: r.post_id ? (thumbs.get(r.post_id) ?? null) : null,
      commentBody: r.comment_id ? (commentBody.get(r.comment_id) ?? null) : null,
      groupId: r.group_id,
      groupName: r.group_id ? (groupName.get(r.group_id) ?? null) : null,
      friendshipId: r.type === "friend_request" ? (friendship.get(r.actor_id) ?? null) : null,
      createdAt: r.created_at,
      unread: !r.read_at,
    };
    if (r.type === "post_reaction" && r.post_id) {
      const existing = reactionItems.get(r.post_id);
      if (existing) {
        if (actor) existing.actors.push(actor);
        existing.actorCount += 1;
        existing.unread = existing.unread || !r.read_at;
        continue;
      }
      const item: NotificationItem = { key: `r:${r.post_id}`, type: r.type, actors: actor ? [actor] : [], actorCount: 1, ...base };
      reactionItems.set(r.post_id, item);
      items.push(item);
      continue;
    }
    items.push({ key: r.id, type: r.type, actors: actor ? [actor] : [], actorCount: 1, ...base });
  }
  return items;
}
