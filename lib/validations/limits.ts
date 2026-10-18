import { z } from "zod";
import { getJakartaDateString } from "@/lib/format";

export const NAME_MAX = 200;
export const TEXT_MAX = 2000;
export const PHONE_MAX = 30;
export const ADDRESS_MAX = 500;

export function nameField(label: string) {
  return z.string().trim().min(2, `${label} wajib diisi`).max(NAME_MAX, `${label} maksimal ${NAME_MAX} karakter`);
}

export function longText(label: string) {
  return z.string().trim().max(TEXT_MAX, `${label} maksimal 2.000 karakter`);
}

export const phoneField = z.string().trim().max(PHONE_MAX, `Nomor telepon maksimal ${PHONE_MAX} karakter`);

export const addressField = z.string().trim().max(ADDRESS_MAX, `Alamat maksimal ${ADDRESS_MAX} karakter`);

export const birthDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir wajib diisi")
  .refine((v) => v >= "1900-01-01" && v <= getJakartaDateString(), "Tanggal lahir harus antara tahun 1900 dan hari ini");
