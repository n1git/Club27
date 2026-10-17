"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { commentSchema, friendUsernameSchema, postSchema, reportSchema, uuidField } from "@/lib/validations/social";
import { type ActionState } from "./types";

const KNOWN = new Set(["FR001", "FR002", "FR003", "FR004", "PO001", "PO002"]);

function fail(error: { code?: string; message: string } | null, fallback: string): ActionState {
  return { ok: false, error: error?.code && KNOWN.has(error.code) ? error.message : fallback };
}

function done(): ActionState {
  revalidatePath("/akun", "layout");
  return { ok: true };
}

export async function sendFriendRequest(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const parsed = friendUsernameSchema.safeParse({ username: formData.get("username") });
  if (!parsed.success || !parsed.data.username) return { ok: false, error: "Username tidak valid" };
  if (await isKeyRateLimited(`friend-request:${session.account_id}`, 30, 3600, true)) return { ok: false, error: RATE_LIMIT_ERROR };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("request_friend", { p_username: parsed.data.username });
  if (error) return fail(error, "Gagal mengirim permintaan");
  revalidatePath("/akun", "layout");
  return { ok: true, message: data === "accepted" ? "Kalian sekarang berteman" : "Permintaan pertemanan dikirim" };
}

export async function respondFriend(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("friendshipId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("respond_friend", { p_id: id.data, p_accept: formData.get("accept") === "1" });
  return error ? fail(error, "Gagal memproses permintaan") : done();
}

export async function removeFriend(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("accountId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_friend", { p_other: id.data });
  return error ? fail(error, "Gagal menghapus teman") : done();
}

export async function blockAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("accountId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("block_account", { p_other: id.data });
  return error ? fail(error, "Gagal memblokir") : done();
}

export async function unblockAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("accountId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("unblock_account", { p_other: id.data });
  return error ? fail(error, "Gagal membuka blokir") : done();
}

export async function createPost(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const parsed = postSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_post", { p_body: parsed.data.body });
  return error ? fail(error, "Gagal memposting") : done();
}

export async function shareWorkout(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("workoutId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const note = String(formData.get("body") ?? "").trim();
  if (note.length > 2000) return { ok: false, error: "Catatan maksimal 2.000 karakter" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("share_workout", { p_log: id.data, p_body: note || null });
  if (error) return fail(error, "Gagal membagikan latihan");
  revalidatePath("/akun", "layout");
  return { ok: true, message: "Latihan dibagikan ke teman" };
}

export async function deletePost(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("postId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("posts").delete().eq("id", id.data).select("id");
  return error || !data?.length ? { ok: false, error: "Gagal menghapus postingan" } : done();
}

export async function toggleReaction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("postId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  if (formData.get("liked") === "1") {
    const { error } = await supabase.from("post_reactions").delete().eq("post_id", id.data).eq("account_id", session.account_id);
    return error ? { ok: false, error: "Gagal membatalkan suka" } : done();
  }
  const { error } = await supabase.from("post_reactions").insert({ post_id: id.data });
  return error && error.code !== "23505" ? { ok: false, error: "Gagal menyukai postingan" } : done();
}

export async function addComment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const parsed = commentSchema.safeParse({ postId: formData.get("postId"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("post_comments").insert({ post_id: parsed.data.postId, body: parsed.data.body });
  return error ? fail(error, "Gagal mengirim komentar") : done();
}

export async function deleteComment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("commentId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("post_comments").delete().eq("id", id.data).select("id");
  return error || !data?.length ? { ok: false, error: "Gagal menghapus komentar" } : done();
}

export async function reportContent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const parsed = reportSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("reports")
    .insert({ target_type: parsed.data.targetType, target_id: parsed.data.targetId, reason: parsed.data.reason });
  if (error?.code === "23505") return { ok: true, message: "Laporan sudah kami terima" };
  return error ? fail(error, "Gagal mengirim laporan") : { ok: true, message: "Laporan terkirim. Terima kasih." };
}
