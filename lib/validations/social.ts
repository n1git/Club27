import { z } from "zod";
import { usernameSchema } from "./username";

export const friendUsernameSchema = z.object({ username: usernameSchema.catch("") });

export const postSchema = z.object({
  body: z.string().trim().min(1, "Tulis sesuatu dulu").max(2000, "Postingan maksimal 2.000 karakter"),
});

export const commentSchema = z.object({
  postId: z.string().uuid("Postingan tidak valid"),
  body: z.string().trim().min(1, "Tulis komentar dulu").max(500, "Komentar maksimal 500 karakter"),
});

export const reportSchema = z.object({
  targetType: z.enum(["post", "comment", "account", "group", "event"]),
  targetId: z.string().uuid("Data tidak valid"),
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter"),
});

export const uuidField = z.string().uuid("Data tidak valid");

export const storyCaptionSchema = z.string().trim().max(200, "Teks cerita maksimal 200 karakter");
