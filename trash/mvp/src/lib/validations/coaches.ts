import { z } from "zod";

export const coachSchema = z.object({
  fullName: z.string().min(2, "Nama pelatih wajib diisi"),
  email: z.string().email("Email tidak valid"),
  phone: z.string().optional(),
});

export const coachUpdateSchema = z.object({
  fullName: z.string().min(2, "Nama pelatih wajib diisi"),
  phone: z.string().optional(),
});
