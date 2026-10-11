import { z } from "zod";

export const promoSchema = z.object({
  title: z.string().min(2, "Judul wajib diisi"),
  body: z.string().min(2, "Isi wajib diisi"),
  activeFrom: z.string().min(1, "Tanggal mulai wajib diisi"),
  activeUntil: z.string().optional(),
});
