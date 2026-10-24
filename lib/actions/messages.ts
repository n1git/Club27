"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { socialLimited } from "@/lib/auth/social-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { removePhotoPaths, uploadImage, validateImage } from "@/lib/media/post-media";
import { messageSchema, uuidField } from "@/lib/validations/social";
import type { ActionState } from "./types";

const KNOWN = new Set(["DM001", "DM002", "DM003", "DM004"]);

export async function sendMessage(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "dm", 300);
  if (limited) return limited;
  const parsed = messageSchema.safeParse({ toId: formData.get("toId"), clientId: formData.get("clientId"), body: formData.get("body") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const file = formData.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  if (photo) {
    const invalid = await validateImage(photo);
    if (invalid) return { ok: false, error: invalid };
  }
  const supabase = await createServerSupabaseClient();
  let path: string | null = null;
  let image: Awaited<ReturnType<typeof uploadImage>> | null = null;
  if (photo) {
    const { data: existing } = await supabase.from("dm_messages").select("id").eq("sender_id", session.account_id).eq("client_id", parsed.data.clientId).maybeSingle();
    if (existing) return { ok: true };
    path = `${session.account_id}/dm/${randomUUID()}.webp`;
    try {
      image = await uploadImage(path, photo);
    } catch {
      return { ok: false, error: "Foto gagal diproses. Coba foto lain." };
    }
  }
  const { error } = await supabase.rpc("send_message", {
    p_to: parsed.data.toId,
    p_body: parsed.data.body,
    p_client_id: parsed.data.clientId,
    p_photo_path: path,
    p_photo_width: image?.width ?? null,
    p_photo_height: image?.height ?? null,
  });
  if (error) {
    if (path) await removePhotoPaths([path]);
    return { ok: false, error: error.code && KNOWN.has(error.code) ? error.message : "Pesan gagal terkirim" };
  }
  return { ok: true };
}

export async function markThreadRead(threadId: string): Promise<void> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(threadId);
  if (!id.success) return;
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("mark_thread_read", { p_thread: id.data });
}

export async function unsendMessage(messageId: string): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(messageId);
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("unsend_message", { p_message: id.data });
  if (error) return { ok: false, error: error.code && KNOWN.has(error.code) ? error.message : "Gagal menarik pesan" };
  if (data) await removePhotoPaths([data as string]);
  revalidatePath("/messages");
  return { ok: true, message: "Pesan ditarik" };
}
