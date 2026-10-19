import { z } from "zod";
import { getJakartaDateString } from "@/lib/format";
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM, WEIGHT_MAX_KG, WEIGHT_MIN_KG } from "./limits";

function measure(label: string, unit: string, min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : String(v).trim().replace(",", ".")),
    z.coerce
      .number({ message: `${label} harus berupa angka` })
      .min(min, `${label} minimal ${min} ${unit}`)
      .max(max, `${label} maksimal ${max} ${unit}`)
      .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, `${label} maksimal satu angka di belakang koma`)
      .optional()
  );
}

export const measurementSchema = z
  .object({
    measuredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi")
      .refine((v) => v >= "1900-01-01" && v <= getJakartaDateString(), "Tanggal harus antara tahun 1900 dan hari ini"),
    heightCm: measure("Tinggi badan", "cm", HEIGHT_MIN_CM, HEIGHT_MAX_CM),
    weightKg: measure("Berat badan", "kg", WEIGHT_MIN_KG, WEIGHT_MAX_KG),
  })
  .refine((d) => d.heightCm != null || d.weightKg != null, "Isi tinggi badan, berat badan, atau keduanya");
