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
