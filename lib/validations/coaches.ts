import { z } from "zod";
import { nameField, phoneField } from "./limits";
import { usernameSchema } from "./username";

export const coachSchema = z.object({
  fullName: nameField("Nama pelatih"),
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang"),
  username: usernameSchema,
  phone: phoneField.optional(),
});

export const coachUpdateSchema = z.object({
  fullName: nameField("Nama pelatih"),
  phone: phoneField.optional(),
  specialization: z.string().trim().max(200, "Spesialisasi terlalu panjang").optional(),
  sessionRate: z.coerce.number().nonnegative("Tarif per sesi tidak valid").optional(),
  roleId: z.string().uuid("Pilih peran pelatih"),
});

export const certificationSchema = z.object({
  coachId: z.string().uuid("Pelatih tidak valid"),
  name: z.string().trim().min(2, "Nama sertifikasi wajib diisi").max(200, "Nama sertifikasi terlalu panjang"),
  number: z.string().trim().max(100, "Nomor sertifikat terlalu panjang").optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").optional(),
});
