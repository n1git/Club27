import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ReportTargetType = "post" | "comment" | "account" | "group" | "event" | "message";

export interface ReportRow {
  id: string;
  status: "open" | "dismissed" | "removed" | "suspended";
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  createdAt: string;
  reporter: string;
  preview: string;
  targetGone: boolean;
  author: { id: string; label: string; active: boolean; banned: boolean } | null;
}

type AccountRow = { id: string; username: string; full_name: string; is_active: boolean; social_banned_at: string | null };

export async function getReports(status: "open" | "resolved"): Promise<ReportRow[]> {
  const supabase = createAdminSupabaseClient();
  const query = supabase.from("reports").select("id, status, target_type, target_id, reason, created_at, reporter_id").order("created_at", { ascending: status === "open" }).limit(status === "open" ? 100 : 20);
  const { data } = await (status === "open" ? query.eq("status", "open") : query.neq("status", "open"));
  const reports = data ?? [];
  const ids = (type: ReportTargetType) => reports.filter((r) => r.target_type === type).map((r) => r.target_id as string);
  const load = async (table: string, columns: string, list: string[]) =>
    list.length ? ((await supabase.from(table).select(columns).in("id", list)).data ?? []) as unknown as Record<string, unknown>[] : [];
  const [posts, comments, groups, events, messages] = await Promise.all([
    load("posts", "id, account_id, kind, body, sport", ids("post")),
    load("post_comments", "id, account_id, body", ids("comment")),
    load("groups", "id, owner_id, name, description", ids("group")),
    load("events", "id, created_by, title", ids("event")),
    load("dm_messages", "id, sender_id, body, photo_path, deleted_at", ids("message")),
  ]);
  const byId = (rows: Record<string, unknown>[]) => new Map(rows.map((r) => [r.id as string, r]));
  const maps = { post: byId(posts), comment: byId(comments), group: byId(groups), event: byId(events), message: byId(messages) };
  const authorOf = (type: ReportTargetType, id: string): string | null => {
    if (type === "account") return id;
    const row = maps[type].get(id);
    if (!row) return null;
    return (row.account_id ?? row.owner_id ?? row.created_by ?? row.sender_id) as string;
  };
  const accountIds = [...new Set([...reports.map((r) => r.reporter_id as string), ...reports.map((r) => authorOf(r.target_type as ReportTargetType, r.target_id as string)).filter((v): v is string => Boolean(v))])];
  const accounts = accountIds.length
    ? (((await supabase.from("accounts").select("id, username, full_name, is_active, social_banned_at").in("id", accountIds)).data ?? []) as AccountRow[])
    : [];
  const people = new Map(accounts.map((a) => [a.id, a]));
  const label = (a: AccountRow | undefined) => (a ? `${a.full_name} (@${a.username})` : "akun dihapus");
  return reports.map((r) => {
    const type = r.target_type as ReportTargetType;
    const tid = r.target_id as string;
    const row = type === "account" ? undefined : maps[type].get(tid);
    const authorId = authorOf(type, tid);
    const author = authorId ? people.get(authorId) : undefined;
    let preview = "";
    if (type === "post" && row) preview = String(row.body ?? `Latihan ${row.sport}`);
    if (type === "comment" && row) preview = String(row.body);
    if (type === "group" && row) preview = `${row.name}${row.description ? `: ${row.description}` : ""}`;
    if (type === "event" && row) preview = String(row.title);
    if (type === "message" && row) preview = row.deleted_at ? "(pesan ditarik)" : `${row.photo_path ? "[foto] " : ""}${row.body ?? ""}`.trim();
    if (type === "account") preview = label(author);
    return {
      id: r.id as string,
      status: r.status as ReportRow["status"],
      targetType: type,
      targetId: tid,
      reason: r.reason as string,
      createdAt: r.created_at as string,
      reporter: label(people.get(r.reporter_id as string)),
      preview,
      targetGone: type === "account" ? !author : !row,
      author: author ? { id: author.id, label: label(author), active: author.is_active, banned: Boolean(author.social_banned_at) } : null,
    };
  });
}
