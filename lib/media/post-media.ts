import sharp from "sharp";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { detectImage } from "@/lib/upload";

export const POST_MEDIA_BUCKET = "post-media";
export const POST_MEDIA_MAX_FILES = 4;
export const POST_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1600;
const SIGNED_SECONDS = 3600;

export interface PostPhoto {
  url: string;
  width: number;
  height: number;
}

export function photoFiles(formData: FormData): File[] {
  return formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
}

export async function validatePhotos(files: File[]): Promise<string | null> {
  if (files.length > POST_MEDIA_MAX_FILES) return "Maksimal 4 foto per postingan";
  for (const file of files) {
    if (file.size > POST_MEDIA_MAX_BYTES) return "Ukuran foto maksimal 5 MB";
    if (!(await detectImage(file))) return "Foto harus berformat JPEG, PNG, atau WebP";
  }
  return null;
}

export async function encodeImage(file: File, square?: number) {
  const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate();
  const { data, info } = await (square
    ? image.resize(square, square, { fit: "cover" })
    : image.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
  )
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function uploadImage(path: string, file: File, square?: number) {
  const image = await encodeImage(file, square);
  const { error } = await createAdminSupabaseClient().storage.from(POST_MEDIA_BUCKET).upload(path, image.data, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  return { width: image.width, height: image.height, bytes: image.data.length };
}

export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await createAdminSupabaseClient().storage.from(POST_MEDIA_BUCKET).createSignedUrls(unique, SIGNED_SECONDS);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

export async function validateImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return "Pilih foto dulu";
  if (file.size > POST_MEDIA_MAX_BYTES) return "Ukuran foto maksimal 5 MB";
  if (!(await detectImage(file))) return "Foto harus berformat JPEG, PNG, atau WebP";
  return null;
}

export async function storePostPhotos(accountId: string, postId: string, files: File[]): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const uploaded: string[] = [];
  try {
    const rows = [];
    for (const [position, file] of files.entries()) {
      const image = await encodeImage(file);
      const path = `${accountId}/${postId}/${position}.webp`;
      const { error } = await admin.storage.from(POST_MEDIA_BUCKET).upload(path, image.data, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      uploaded.push(path);
      rows.push({ post_id: postId, account_id: accountId, path, position, width: image.width, height: image.height, bytes: image.data.length });
    }
    const { error } = await admin.from("post_media").insert(rows);
    if (error) throw error;
    return true;
  } catch {
    if (uploaded.length) await admin.storage.from(POST_MEDIA_BUCKET).remove(uploaded);
    return false;
  }
}

export async function signPhotos(rows: { post_id: string; path: string; position: number; width: number; height: number }[]) {
  const byPost = new Map<string, PostPhoto[]>();
  if (!rows.length) return byPost;
  const { data } = await createAdminSupabaseClient().storage.from(POST_MEDIA_BUCKET).createSignedUrls(rows.map((r) => r.path), SIGNED_SECONDS);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  for (const r of [...rows].sort((a, b) => a.position - b.position)) {
    const url = urls.get(r.path);
    if (!url) continue;
    byPost.set(r.post_id, [...(byPost.get(r.post_id) ?? []), { url, width: r.width, height: r.height }]);
  }
  return byPost;
}

export async function removePhotoPaths(paths: string[]) {
  if (paths.length) await createAdminSupabaseClient().storage.from(POST_MEDIA_BUCKET).remove(paths);
}

export async function postPhotoPaths(postId: string): Promise<string[]> {
  const { data } = await createAdminSupabaseClient().from("post_media").select("path").eq("post_id", postId);
  return (data ?? []).map((r) => r.path as string);
}

export async function removeAccountPhotos(accountId: string) {
  const admin = createAdminSupabaseClient();
  const paths = new Set<string>();
  const { data: folders } = await admin.storage.from(POST_MEDIA_BUCKET).list(accountId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await admin.storage.from(POST_MEDIA_BUCKET).list(`${accountId}/${folder.name}`, { limit: 10 });
    for (const f of files ?? []) paths.add(`${accountId}/${folder.name}/${f.name}`);
  }
  for (let i = 0; i < paths.size; i += 100) await removePhotoPaths([...paths].slice(i, i + 100));
}
