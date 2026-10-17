"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseJakartaLocalInput } from "@/lib/format";
import { promoSchema } from "@/lib/validations/promo";
import { detectImage, PROMO_MAX_BYTES, promoObjectPath } from "@/lib/upload";
import { type ActionState } from "./types";

export async function createPromo(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireActionPermission("promo.manage");

  const parsed = promoSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    activeFrom: formData.get("activeFrom"),
    activeUntil: formData.get("activeUntil") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();

  let imageUrl: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > PROMO_MAX_BYTES) return { ok: false, error: "Ukuran gambar maksimal 2 MB" };
    const image = await detectImage(file);
    if (!image) return { ok: false, error: "Gambar harus berformat PNG, JPEG, atau WebP" };
    const path = `${session.club_id}/${crypto.randomUUID()}.${image.ext}`;
    const { error: uploadError } = await supabase.storage
      .from("promos")
      .upload(path, file, { contentType: image.type });
    if (uploadError) {
      return { ok: false, error: "Gagal mengunggah gambar" };
    }
    imageUrl = supabase.storage.from("promos").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("promos").insert({
    title: parsed.data.title,
    body: parsed.data.body,
    image_url: imageUrl,
    active_from: parseJakartaLocalInput(parsed.data.activeFrom),
    active_until: parsed.data.activeUntil ? parseJakartaLocalInput(parsed.data.activeUntil) : null,
    author_id: session.sub,
  });

  if (error) {
    return { ok: false, error: "Gagal menyimpan promo" };
  }

  revalidatePath("/admin/promo");
  return { ok: true };
}

export async function deletePromo(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("promo.manage");
  const promoId = String(formData.get("promoId"));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("promos").delete().eq("id", promoId).select("id, image_url");
  if (error || !data?.length) return { ok: false, error: "Gagal menghapus promo" };
  const path = promoObjectPath(data[0].image_url);
  if (path) await supabase.storage.from("promos").remove([path]);
  revalidatePath("/admin/promo");
  return { ok: true, message: "Promo dihapus" };
}
