import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media/post-media";

export interface ChatPeer {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  clientId: string | null;
  mine: boolean;
  body: string | null;
  photoUrl: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  createdAt: string;
  readAt: string | null;
  deleted: boolean;
}

export interface ChatThreadData {
  peer: ChatPeer;
  canSend: boolean;
  threadId: string | null;
  messages: ChatMessage[];
}

export interface InboxItem {
  threadId: string;
  peer: ChatPeer;
  lastAt: string;
  preview: string;
  unread: number;
}

const THREAD_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InboxRow = {
  thread_id: string;
  other_id: string;
  other_username: string;
  other_full_name: string;
  other_avatar_path: string | null;
  last_message_at: string;
  last_body: string | null;
  last_has_photo: boolean;
  last_deleted: boolean;
  last_sender_id: string;
  unread_count: number;
};

export async function getInbox(accountId: string): Promise<InboxItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("dm_inbox");
  const rows = (data ?? []) as InboxRow[];
  const urls = await signPaths(rows.flatMap((r) => (r.other_avatar_path ? [r.other_avatar_path] : [])));
  return rows.map((r) => {
    const own = r.last_sender_id === accountId;
    const text = r.last_deleted ? "Pesan ditarik" : r.last_body ? r.last_body : r.last_has_photo ? "Foto" : "";
    return {
      threadId: r.thread_id,
      peer: { id: r.other_id, username: r.other_username, fullName: r.other_full_name, avatarUrl: r.other_avatar_path ? (urls.get(r.other_avatar_path) ?? null) : null },
      lastAt: r.last_message_at,
      preview: own && !r.last_deleted ? `Anda: ${text}` : text,
      unread: r.unread_count,
    };
  });
}

type OpenRow = {
  other_id: string;
  other_username: string;
  other_full_name: string;
  other_avatar_path: string | null;
  thread_id: string | null;
  can_send: boolean;
};

type MessageRow = {
  id: string;
  sender_id: string;
  client_id: string | null;
  body: string | null;
  photo_path: string | null;
  photo_width: number | null;
  photo_height: number | null;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
};

export async function loadThread(username: string, accountId: string): Promise<ChatThreadData | null> {
  if (!/^[a-z][a-z0-9._]{2,29}$/.test(username)) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("dm_open", { p_username: username });
  const open = ((data ?? []) as OpenRow[])[0];
  if (!open) return null;
  let messages: ChatMessage[] = [];
  if (open.thread_id && UUID.test(open.thread_id)) {
    const { data: rows } = await supabase
      .from("dm_messages")
      .select("id, sender_id, client_id, body, photo_path, photo_width, photo_height, created_at, read_at, deleted_at")
      .eq("thread_id", open.thread_id)
      .order("created_at", { ascending: false })
      .limit(THREAD_LIMIT);
    const list = ((rows ?? []) as MessageRow[]).reverse();
    const urls = await signPaths([...list.flatMap((m) => (m.photo_path ? [m.photo_path] : [])), ...(open.other_avatar_path ? [open.other_avatar_path] : [])]);
    messages = list.map((m) => ({
      id: m.id,
      clientId: m.client_id,
      mine: m.sender_id === accountId,
      body: m.body,
      photoUrl: m.photo_path ? (urls.get(m.photo_path) ?? null) : null,
      photoWidth: m.photo_width,
      photoHeight: m.photo_height,
      createdAt: m.created_at,
      readAt: m.read_at,
      deleted: Boolean(m.deleted_at),
    }));
    return {
      peer: { id: open.other_id, username: open.other_username, fullName: open.other_full_name, avatarUrl: open.other_avatar_path ? (urls.get(open.other_avatar_path) ?? null) : null },
      canSend: open.can_send,
      threadId: open.thread_id,
      messages,
    };
  }
  const avatar = open.other_avatar_path ? (await signPaths([open.other_avatar_path])).get(open.other_avatar_path) : null;
  return {
    peer: { id: open.other_id, username: open.other_username, fullName: open.other_full_name, avatarUrl: avatar ?? null },
    canSend: open.can_send,
    threadId: null,
    messages,
  };
}
