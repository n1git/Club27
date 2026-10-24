"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { socialLimited } from "@/lib/auth/social-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { removePhotoPaths, uploadImage, validateImage } from "@/lib/media/post-media";
import type { ActionState } from "./types";

const SIDE = 512;

export async function updateAvatar(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "avatar", 20);
  if (limited) return limited;
  const file = formData.get("avatar");
  const photo = file instanceof File ? file : null;
  const invalid = await validateImage(photo);
  if (invalid || !photo) return { ok: false, error: invalid ?? "Pilih foto dulu" };
  const admin = createAdminSupabaseClient();
  const { data: current } = await admin.from("accounts").select("avatar_path").eq("id", session.account_id).maybeSingle();
  const path = `${session.account_id}/avatar/${Date.now()}.webp`;
  try {
    await uploadImage(path, photo, SIDE);
  } catch {
    return { ok: false, error: "Foto gagal diproses. Coba foto lain." };
  }
  const { error } = await admin.from("accounts").update({ avatar_path: path }).eq("id", session.account_id);
  if (error) {
    await removePhotoPaths([path]);
    return { ok: false, error: "Gagal menyimpan foto profil" };
  }
  if (current?.avatar_path) await removePhotoPaths([current.avatar_path as string]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto profil diperbarui" };
}

export async function removeAvatar(): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const admin = createAdminSupabaseClient();
  const { data: current } = await admin.from("accounts").select("avatar_path").eq("id", session.account_id).maybeSingle();
  if (!current?.avatar_path) return { ok: true };
  const { error } = await admin.from("accounts").update({ avatar_path: null }).eq("id", session.account_id);
  if (error) return { ok: false, error: "Gagal menghapus foto profil" };
  await removePhotoPaths([current.avatar_path as string]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto profil dihapus" };
}
