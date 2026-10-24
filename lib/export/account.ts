import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/export/csv";
import { buildZip, type ZipEntry } from "@/lib/export/zip";
import { APP_NAME } from "@/lib/config";

type Row = Record<string, unknown>;

const PAGE = 1000;

async function fetchAll(table: string, select: string, column: string, value: string, orderBy = "created_at"): Promise<Row[]> {
  const supabase = createAdminSupabaseClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(select).eq(column, value).order(orderBy, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`export failed for ${table}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function flat(rows: Row[], relation: string, field: string, as: string): Row[] {
  return rows.map(({ [relation]: rel, ...rest }) => {
    const one = Array.isArray(rel) ? rel[0] : rel;
    return { ...rest, [as]: (one as Row | null | undefined)?.[field] ?? "" };
  });
}

async function messageRows(accountId: string): Promise<Row[]> {
  const supabase = createAdminSupabaseClient();
  const threads = [
    ...(await fetchAll("dm_threads", "id, account_a, account_b", "account_a", accountId)),
    ...(await fetchAll("dm_threads", "id, account_a, account_b", "account_b", accountId)),
  ];
  const otherIds = threads.map((t) => (t.account_a === accountId ? t.account_b : t.account_a) as string);
  const { data: others } = otherIds.length ? await supabase.from("accounts").select("id, username").in("id", otherIds) : { data: [] };
  const username = new Map((others ?? []).map((o) => [o.id as string, o.username as string]));
  const rows: Row[] = [];
  for (const thread of threads) {
    const other = username.get((thread.account_a === accountId ? thread.account_b : thread.account_a) as string) ?? "";
    const { data, error } = await supabase
      .from("dm_messages")
      .select("id, sender_id, body, photo_path, created_at, read_at, deleted_at")
      .eq("thread_id", thread.id as string)
      .order("created_at", { ascending: true })
      .limit(10000);
    if (error) throw new Error("export failed for dm_messages");
    for (const m of data ?? []) {
      rows.push({ id: m.id, percakapan_dengan: other, arah: m.sender_id === accountId ? "dikirim" : "diterima", pesan: m.body ?? "", ada_foto: m.photo_path ? "ya" : "tidak", created_at: m.created_at, read_at: m.read_at, deleted_at: m.deleted_at });
    }
  }
  return rows;
}

export async function buildAccountExport(accountId: string): Promise<{ filename: string; zip: Buffer }> {
  const supabase = createAdminSupabaseClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, email, username, full_name, phone, address, avatar_path, created_at, last_login_at")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) throw new Error("account not found");

  const entries: ZipEntry[] = [];
  const counts: string[] = [];
  const add = (file: string, rows: Row[]) => {
    entries.push({ name: `${file}.csv`, data: toCsv(rows) });
    counts.push(`${file}: ${rows.length}`);
  };

  add("akun", [account as Row]);
  add("latihan", await fetchAll("workout_logs", "id, sport, performed_on, duration_min, distance_m, notes, created_at", "account_id", accountId));
  add("kesehatan", await fetchAll("body_measurements", "measured_on, height_cm, weight_kg, created_at", "account_id", accountId));
  add("lencana", await fetchAll("achievements", "code, ref, earned_on, created_at", "account_id", accountId));
  add("tantangan_diikuti", flat(await fetchAll("challenge_participants", "challenge_id, created_at, c:challenges(name, metric, target, starts_on, ends_on)", "account_id", accountId), "c", "name", "nama_tantangan"));
  add("foto", await fetchAll("post_media", "post_id, position, width, height, bytes, created_at", "account_id", accountId));
  add("target_latihan", ((await supabase.from("workout_goals").select("weekly_sessions").eq("account_id", accountId)).data ?? []) as Row[]);

  const friendships = [
    ...(await fetchAll("friendships", "id, status, created_at, responded_at, other:accounts!friendships_addressee_id_fkey(username)", "requester_id", accountId)).map((r) => ({ ...r, arah: "dikirim" })),
    ...(await fetchAll("friendships", "id, status, created_at, responded_at, other:accounts!friendships_requester_id_fkey(username)", "addressee_id", accountId)).map((r) => ({ ...r, arah: "diterima" })),
  ];
  add("teman", flat(friendships, "other", "username", "username_lain"));
  add("diblokir", flat(await fetchAll("blocks", "created_at, other:accounts!blocks_blocked_id_fkey(username)", "blocker_id", accountId), "other", "username", "username_lain"));
  add("postingan", await fetchAll("posts", "id, kind, body, sport, performed_on, duration_min, distance_m, visibility, created_at", "account_id", accountId));
  add("komentar", await fetchAll("post_comments", "id, post_id, body, created_at", "account_id", accountId));
  add("reaksi", await fetchAll("post_reactions", "post_id, created_at", "account_id", accountId));
  add("grup_diikuti", flat(await fetchAll("group_members", "group_id, role, status, created_at, g:groups(name)", "account_id", accountId), "g", "name", "nama_grup"));
  add("papan_peringkat_klub", flat(await fetchAll("club_leaderboard_optins", "club_id, created_at, c:clubs(name)", "account_id", accountId), "c", "name", "nama_klub"));
  add("grup_dimiliki", await fetchAll("groups", "id, name, description, created_at", "owner_id", accountId));
  add("event_dibuat", await fetchAll("events", "id, group_id, title, description, location, starts_at, ends_at, capacity, cancelled_at, created_at", "created_by", accountId));
  add("rsvp_event", flat(await fetchAll("event_rsvps", "event_id, status, updated_at, e:events(title)", "account_id", accountId).catch(() => []), "e", "title", "judul_event"));
  add("keanggotaan_klub", flat(await fetchAll("club_profiles", "id, role, is_active, created_at, c:clubs(name)", "account_id", accountId), "c", "name", "klub"));
  add("permintaan_gabung", flat(await fetchAll("club_join_requests", "id, status, full_name, date_of_birth, phone, message, created_at, decided_at, c:clubs(name)", "account_id", accountId), "c", "name", "klub"));
  add("cerita", await fetchAll("stories", "id, caption, width, height, created_at, expires_at", "account_id", accountId));
  add("cerita_dilihat", await fetchAll("story_views", "story_id, viewed_at", "viewer_id", accountId, "viewed_at"));
  add("notifikasi", flat(await fetchAll("notifications", "type, read_at, created_at, other:accounts!notifications_actor_id_fkey(username)", "recipient_id", accountId), "other", "username", "username_lain"));
  add("pesan", await messageRows(accountId));
  add("laporan_dikirim", await fetchAll("reports", "id, target_type, target_id, reason, created_at", "reporter_id", accountId));
  const { data: consents } = await supabase.from("consents").select("kind, version, accepted_at, revoked_at").eq("subject_type", "account").eq("subject_id", accountId);
  add("persetujuan", (consents ?? []) as Row[]);

  const stamp = new Date().toISOString();
  entries.unshift({
    name: "BACA_SAYA.txt",
    data: Buffer.from(
      `Ekspor data akun ${account.username} dari ${APP_NAME}\r\nDibuat: ${stamp}\r\n\r\nSetiap file .csv berisi satu jenis data (UTF-8, dapat dibuka di Excel atau Google Sheets).\r\nKata sandi dan token tidak disertakan. Data klub tempat Anda menjadi anggota dikelola oleh klub tersebut dan tidak ada di file ini.\r\n\r\nJumlah baris:\r\n${counts.join("\r\n")}\r\n`,
      "utf8"
    ),
  });
  return { filename: `ekspor-akun-${account.username}-${stamp.slice(0, 10)}.zip`, zip: buildZip(entries) };
}
