import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/commerce";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(120, "Nama terlalu panjang"),
  sku: z.string().trim().max(60, "SKU terlalu panjang").optional(),
  category: z.string().trim().max(60, "Kategori terlalu panjang").optional(),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif").max(1_000_000_000, "Harga terlalu besar"),
  trackStock: z.boolean(),
  stockQty: z.coerce.number().int("Stok harus bilangan bulat").min(0, "Stok tidak boleh negatif").max(1_000_000, "Stok terlalu besar"),
});

const methodSchema = z.enum(PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]]);

export const paymentSchema = z.object({
  method: methodSchema,
  amount: z.coerce.number().positive("Jumlah pembayaran harus lebih dari 0").max(10_000_000_000),
  reference: z.string().trim().max(120).optional(),
});

export const orderPayloadSchema = z.object({
  requestId: z.string().uuid("Data tidak valid"),
  memberId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().max(120).nullable().optional(),
  items: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("product"), productId: z.string().uuid(), qty: z.number().int().min(1).max(9999) }),
        z.object({ kind: z.literal("booking"), bookingId: z.string().uuid() }),
      ])
    )
    .min(1, "Pilih minimal satu item")
    .max(100, "Maksimal 100 item"),
  payments: z.array(paymentSchema).max(10),
});
