"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { socialBlocked } from "@/lib/auth/social-access";
import { socialLimited } from "@/lib/auth/social-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { peopleMap } from "@/lib/data/social";
import { removePhotoPaths, uploadImage, validateImage } from "@/lib/media/post-media";
import { storyCaptionSchema, uuidField } from "@/lib/validations/social";
import type { ActionState } from "./types";

const KNOWN = new Set(["ST001", "ST002"]);

export interface StoryViewer {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  viewedAt: string;
}

export async function createStory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "story", 20);
  if (limited) return limited;
  const caption = storyCaptionSchema.safeParse(formData.get("caption") ?? "");
  if (!caption.success) return { ok: false, error: caption.error.issues[0]?.message ?? "Data tidak valid" };
  const file = formData.get("photo");
  const photo = file instanceof File ? file : null;
  const invalid = await validateImage(photo);
  if (invalid || !photo) return { ok: false, error: invalid ?? "Pilih foto dulu" };
  const path = `${session.account_id}/s/${randomUUID()}.webp`;
  let image: Awaited<ReturnType<typeof uploadImage>>;
  try {
    image = await uploadImage(path, photo);
  } catch {
    return { ok: false, error: "Foto gagal diproses. Coba foto lain." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_story", {
    p_path: path,
    p_width: image.width,
    p_height: image.height,
    p_bytes: image.bytes,
    p_caption: caption.data || null,
  });
  if (error) {
    await removePhotoPaths([path]);
    return { ok: false, error: error.code && KNOWN.has(error.code) ? error.message : "Gagal membagikan cerita" };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Cerita dibagikan" };
}

export async function deleteStory(storyId: string): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(storyId);
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("delete_story", { p_story: id.data });
  if (error) return { ok: false, error: "Gagal menghapus cerita" };
  await removePhotoPaths([data as string]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Cerita dihapus" };
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const session = await requireActionRole("personal");
  const id = uuidField.safeParse(storyId);
  if (!id.success || (await socialBlocked(session.account_id))) return;
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("mark_story_viewed", { p_story: id.data });
}

export async function listStoryViewers(storyId: string): Promise<StoryViewer[]> {
  const session = await requireActionRole("personal");
  const id = uuidField.safeParse(storyId);
  if (!id.success || (await socialBlocked(session.account_id))) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("story_views").select("viewer_id, viewed_at").eq("story_id", id.data).order("viewed_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  const people = await peopleMap(rows.map((r) => r.viewer_id as string));
  return rows.flatMap((r) => {
    const person = people.get(r.viewer_id as string);
    return person ? [{ id: person.id, fullName: person.fullName, username: person.username, avatarUrl: person.avatarUrl, viewedAt: r.viewed_at as string }] : [];
  });
}

