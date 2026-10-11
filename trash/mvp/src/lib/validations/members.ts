import { z } from "zod";

const baseChildFields = {
  childFullName: z.string().min(2, "Nama anak wajib diisi"),
  dateOfBirth: z.string().min(1, "Tanggal lahir wajib diisi"),
  notes: z.string().optional(),
  address: z.string().optional(),
  preferredLocationId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
};

export const childSchema = z.discriminatedUnion("parentMode", [
  z.object({
    parentMode: z.literal("existing"),
    existingParentId: z.string().uuid("Pilih orang tua dari daftar"),
    ...baseChildFields,
  }),
  z.object({
    parentMode: z.literal("new"),
    parentFullName: z.string().min(2, "Nama orang tua wajib diisi"),
    parentEmail: z.string().email("Email orang tua tidak valid"),
    parentPhone: z.string().optional(),
    ...baseChildFields,
  }),
]);

export const childUpdateSchema = z.object({
  childFullName: z.string().min(2, "Nama anak wajib diisi"),
  dateOfBirth: z.string().min(1, "Tanggal lahir wajib diisi"),
  notes: z.string().optional(),
  address: z.string().optional(),
  preferredLocationId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
});
