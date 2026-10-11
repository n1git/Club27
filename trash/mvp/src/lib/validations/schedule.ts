import { z } from "zod";

export const classSchema = z
  .object({
    instructorId: z.string().uuid("Pilih pelatih"),
    locationId: z.string().uuid("Pilih lokasi"),
    classTypeId: z.string().uuid("Pilih jenis kelas"),
    startTime: z.string().min(1, "Waktu mulai wajib diisi"),
    endTime: z.string().min(1, "Waktu selesai wajib diisi"),
    capacity: z.coerce.number().int().positive("Kapasitas harus lebih dari 0"),
  })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    message: "Waktu selesai harus setelah waktu mulai",
    path: ["endTime"],
  });
