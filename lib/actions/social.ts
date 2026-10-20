"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { socialLimited } from "@/lib/auth/social-limit";
import { socialBlocked } from "@/lib/auth/social-access";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { APP_NAME } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { commentSchema, friendUsernameSchema, postSchema, reportSchema, uuidField } from "@/lib/validations/social";
import { photoFiles, postPhotoPaths, removePhotoPaths, storePostPhotos, validatePhotos } from "@/lib/media/post-media";
import { type ActionState } from "./types";

const KNOWN = new Set(["FR001", "FR002", "FR003", "FR004", "PO001", "PO002"]);

function fail(error: { code?: string; message: string } | null, fallback: string): ActionState {
  return { ok: false, error: error?.code && KNOWN.has(error.code) ? error.message : fallback };
}

function done(): ActionState {
  revalidatePath("/home", "layout");
  return { ok: true };
}

async function notifyNewReport(targetType: string) {
  const to = process.env.REPORT_NOTIFY_EMAIL?.trim();
  if (!to || !isEmailConfigured()) return;
  const link = `${SITE_URL}/superadmin/reports`;
  await sendEmail({
    to,
    subject: `Laporan baru di ${APP_NAME}`,
    text: `Ada laporan baru (${targetType}). Tinjau di ${link}`,
    html: `<p>Ada laporan baru (${targetType}).</p><p>Tinjau di <a href="${link}">${link}</a></p>`,
  }).catch(() => false);
}

export async function sendFriendRequest(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const parsed = friendUsernameSchema.safeParse({ username: formData.get("username") });
  if (!parsed.success || !parsed.data.username) return { ok: false, error: "Username tidak valid" };
  const blocked = await socialBlocked(session.account_id);
  if (blocked) return blocked;
  if (await isKeyRateLimited(`friend-request:${session.account_id}`, 30, 3600, true)) return { ok: false, error: RATE_LIMIT_ERROR };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("request_friend", { p_username: parsed.data.username });
  if (error) return fail(error, "Gagal mengirim permintaan");
  revalidatePath("/home", "layout");
  return { ok: true, message: data === "accepted" ? "Kalian sekarang berteman" : "Permintaan pertemanan dikirim" };
}

export async function respondFriend(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const blocked = await socialBlocked(session.account_id);
  if (blocked) return blocked;
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
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "post", 30);
  if (limited) return limited;
  const parsed = postSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const photos = photoFiles(formData);
  const invalid = await validatePhotos(photos);
  if (invalid) return { ok: false, error: invalid };
  const supabase = await createServerSupabaseClient();
  const { data: postId, error } = await supabase.rpc("create_post", { p_body: parsed.data.body });
  if (error || !postId) return fail(error, "Gagal memposting");
  if (photos.length && !(await storePostPhotos(session.account_id, postId as string, photos))) {
    await supabase.from("posts").delete().eq("id", postId as string);
    return { ok: false, error: "Foto gagal diproses. Coba foto lain." };
  }
  return done();
}

export async function shareWorkout(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "share", 30);
  if (limited) return limited;
  const id = uuidField.safeParse(formData.get("workoutId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const note = String(formData.get("body") ?? "").trim();
  if (note.length > 2000) return { ok: false, error: "Catatan maksimal 2.000 karakter" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("share_workout", { p_log: id.data, p_body: note || null });
  if (error) return fail(error, "Gagal membagikan latihan");
  revalidatePath("/home", "layout");
  return { ok: true, message: "Latihan dibagikan ke teman" };
}

export async function shareAchievement(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "share", 30);
  if (limited) return limited;
  const id = uuidField.safeParse(formData.get("achievementId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("achievements").select("achievement_types(name, description)").eq("id", id.data).maybeSingle();
  const type = (Array.isArray(data?.achievement_types) ? data?.achievement_types[0] : data?.achievement_types) as { name: string; description: string } | null | undefined;
  if (!type) return { ok: false, error: "Lencana tidak ditemukan" };
  const { error } = await supabase.rpc("create_post", { p_body: `Meraih lencana ${type.name}: ${type.description}.` });
  if (error) return fail(error, "Gagal membagikan lencana");
  revalidatePath("/home", "layout");
  return { ok: true, message: "Lencana dibagikan ke teman" };
}

export async function deletePost(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("postId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data: own } = await supabase.from("posts").select("id").eq("id", id.data).eq("account_id", session.account_id).maybeSingle();
  if (!own) return { ok: false, error: "Gagal menghapus postingan" };
  const paths = await postPhotoPaths(id.data);
  const { data, error } = await supabase.from("posts").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menghapus postingan" };
  await removePhotoPaths(paths);
  return done();
}

const REACTIONS = ["kudos", "fire", "strong", "clap"] as const;

export async function toggleReaction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("postId"));
  const kind = String(formData.get("kind") ?? "kudos");
  if (!id.success || !REACTIONS.includes(kind as (typeof REACTIONS)[number])) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data: current } = await supabase.from("post_reactions").select("kind").eq("post_id", id.data).eq("account_id", session.account_id).maybeSingle();
  if (current?.kind === kind) {
    const { error } = await supabase.from("post_reactions").delete().eq("post_id", id.data).eq("account_id", session.account_id);
    return error ? { ok: false, error: "Gagal membatalkan reaksi" } : done();
  }
  const blocked = await socialBlocked(session.account_id);
  if (blocked) return blocked;
  const { error } = current
    ? await supabase.from("post_reactions").update({ kind }).eq("post_id", id.data).eq("account_id", session.account_id)
    : await supabase.from("post_reactions").insert({ post_id: id.data, kind });
  return error && error.code !== "23505" ? { ok: false, error: "Gagal memberi reaksi" } : done();
}

export async function addComment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "comment", 60);
  if (limited) return limited;
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
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "report", 20);
  if (limited) return limited;
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
  if (error) return fail(error, "Gagal mengirim laporan");
  await notifyNewReport(parsed.data.targetType);
  return { ok: true, message: "Laporan terkirim. Terima kasih." };
}
