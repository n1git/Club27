import { z } from "zod";

export const packageSchema = z.object({
  name: z.string().min(2, "Nama paket wajib diisi"),
  price: z.coerce.number().nonnegative("Harga tidak valid"),
  billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
  description: z.string().optional(),
});

export const subscriptionSchema = z.object({
  childId: z.string().uuid("Pilih anak"),
  packageId: z.string().uuid("Pilih paket"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
});

export const generateInvoicesSchema = z
  .object({
    periodStart: z.string().min(1, "Awal periode wajib diisi"),
    periodEnd: z.string().min(1, "Akhir periode wajib diisi"),
    dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi"),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "Akhir periode harus setelah awal periode",
    path: ["periodEnd"],
  });
