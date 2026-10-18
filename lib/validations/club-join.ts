import { z } from "zod";
import { getJakartaDateString } from "@/lib/format";
import { isMinor } from "@/lib/privacy";
import { longText, nameField, phoneField } from "./limits";

export const joinRequestSchema = z.object({
  code: z.string().trim().toLowerCase().min(3, "Masukkan kode klub").max(60, "Kode klub terlalu panjang"),
  fullName: nameField("Nama"),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir wajib diisi")
    .refine((v) => v >= "1900-01-01" && v <= getJakartaDateString(), "Tanggal lahir harus antara tahun 1900 dan hari ini")
    .refine((v) => !isMinor(v), "Pendaftaran mandiri hanya untuk usia 18 tahun ke atas. Minta klub mendaftarkan anak Anda."),
  phone: phoneField.optional(),
  message: longText("Pesan").max(300, "Pesan maksimal 300 karakter").optional(),
  acceptPrivacy: z.literal("on", { message: "Setujui pencatatan data Anda oleh klub untuk melanjutkan" }),
});

export const decideJoinSchema = z.object({
  requestId: z.string().uuid("Permintaan tidak valid"),
  approve: z.enum(["1", "0"]),
  coachId: z.string().uuid("Pilih pelatih").optional(),
  memberId: z.string().uuid("Anggota tidak valid").optional(),
});
