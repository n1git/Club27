import { z } from "zod";

export const RESERVED_USERNAMES = new Set(["admin", "superadmin", "support", "root", "system", "club27"]);
export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/;

const usernameFormat = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(USERNAME_PATTERN, "Username hanya huruf kecil, angka, titik dan garis bawah, diawali huruf");

export const usernameSchema = usernameFormat.refine((value) => !RESERVED_USERNAMES.has(value), "Username tidak tersedia");

export const superadminUsernameSchema = usernameFormat;

export function suggestUsername(email: string, allowReserved = false): string {
  let base = (email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9._]/g, "");
  if (!/^[a-z]/.test(base)) base = `u${base}`;
  base = base.slice(0, 30).padEnd(3, "0");
  return !allowReserved && RESERVED_USERNAMES.has(base) ? `${base}2` : base;
}

export function usernameDbError(message: string | undefined): string | null {
  return message === "Username sudah dipakai" || message === "Username tidak tersedia" ? message : null;
}
