import { z } from "zod";
import { getJakartaDateString } from "@/lib/format";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const challengeSchema = z
  .object({
    name: z.string().trim().min(3, "Nama tantangan minimal 3 karakter").max(100, "Nama tantangan maksimal 100 karakter"),
    metric: z.enum(["sessions", "distance", "duration"], { message: "Pilih metrik" }),
    target: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().replace(",", ".") : v),
      z.coerce.number({ message: "Target harus berupa angka" }).positive("Target harus lebih dari 0")
    ),
    sport: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^[a-z_]{2,30}$/).optional()),
    startsOn: z.string().regex(DATE, "Tanggal mulai wajib diisi"),
    endsOn: z.string().regex(DATE, "Tanggal selesai wajib diisi"),
  })
  .refine((d) => d.endsOn >= d.startsOn, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai" })
  .refine((d) => d.endsOn >= getJakartaDateString(), { message: "Tanggal selesai tidak boleh sebelum hari ini" })
  .refine((d) => (Date.parse(d.endsOn) - Date.parse(d.startsOn)) / 86400000 <= 366, { message: "Tantangan maksimal 366 hari" })
  .transform((d) => ({
    ...d,
    target: Math.round(d.metric === "distance" ? d.target * 1000 : d.target),
  }))
  .refine((d) => d.target >= 1 && d.target <= 100000000, { message: "Target di luar batas" })
  .refine((d) => d.metric === "distance" || Number.isInteger(d.target), { message: "Target sesi dan durasi harus bilangan bulat" });
