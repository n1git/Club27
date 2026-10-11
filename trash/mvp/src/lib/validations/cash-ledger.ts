import { z } from "zod";

export const manualAdjustmentSchema = z.object({
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  reason: z.string().min(3, "Alasan wajib diisi"),
});
