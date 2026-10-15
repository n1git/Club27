import { z } from "zod";

import { RESERVED_USERNAMES, USERNAME_PATTERN, suggestUsername } from "@/lib/username-suggest";

export { RESERVED_USERNAMES, USERNAME_PATTERN, suggestUsername };

const usernameFormat = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(USERNAME_PATTERN, "Username hanya huruf kecil, angka, titik dan garis bawah, diawali huruf");

export const usernameSchema = usernameFormat.refine((value) => !RESERVED_USERNAMES.has(value), "Username tidak tersedia");

export const superadminUsernameSchema = usernameFormat;

export function usernameDbError(message: string | undefined): string | null {
  return message === "Username sudah dipakai" || message === "Username tidak tersedia" ? message : null;
}
