import { z } from "zod";
import { getJakartaDateString } from "@/lib/format";
import { longText } from "./limits";

export const workoutSchema = z.object({
  sport: z.string().min(1, "Pilih olahraga"),
  performedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi")
    .refine((v) => v >= "2000-01-01" && v <= getJakartaDateString(), "Tanggal harus antara tahun 2000 dan hari ini"),
  durationMin: z.coerce.number().int("Durasi harus bilangan bulat").min(1, "Durasi minimal 1 menit").max(1440, "Durasi maksimal 1.440 menit"),
  distanceM: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int("Jarak harus bilangan bulat").min(1, "Jarak minimal 1 meter").max(1000000, "Jarak maksimal 1.000.000 meter").optional()
  ),
  notes: longText("Catatan").optional(),
});

export const weeklyGoalSchema = z.object({
  weeklySessions: z.coerce.number().int("Target harus bilangan bulat").min(1, "Target minimal 1 sesi").max(21, "Target maksimal 21 sesi"),
});
