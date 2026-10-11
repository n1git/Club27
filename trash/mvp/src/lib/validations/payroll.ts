import { z } from "zod";

export const payrollRunSchema = z
  .object({
    coachId: z.string().uuid("Pilih pelatih"),
    periodStart: z.string().min(1, "Awal periode wajib diisi"),
    periodEnd: z.string().min(1, "Akhir periode wajib diisi"),
    baseSalary: z.coerce.number().nonnegative("Gaji pokok tidak valid"),
    bonus: z.coerce.number().nonnegative("Bonus tidak valid").default(0),
    thr: z.coerce.number().nonnegative("THR tidak valid").default(0),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "Akhir periode harus setelah awal periode",
    path: ["periodEnd"],
  });
