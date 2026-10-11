import { z } from "zod";

const COMMON_PASSWORDS = new Set([
  "password1", "password12", "password123", "password1234", "passw0rd123", "p@ssword123",
  "qwerty123", "qwerty1234", "qwertyuiop1", "asdfghjkl1", "zxcvbnm123", "1q2w3e4r5t",
  "abc1234567", "abcd123456", "a123456789", "123456789a", "1234567890a", "12345678ab",
  "iloveyou12", "iloveyou123", "welcome123", "welcome1234", "admin12345", "admin123456",
  "letmein123", "monkey1234", "dragon1234", "football12", "sunshine12", "princess12",
  "indonesia1", "indonesia123", "jakarta123", "bismillah1", "bismillah123", "rahasia123",
  "sayang1234", "cintaku123", "katasandi1", "katasandi123", "swimma123", "swimma1234", "27club1234", "27club12345",
  "renang1234", "gym1234567", "klub123456", "pelatih123", "anggota123", "admin2024",
  "admin2025", "admin2026", "password2024", "password2025", "password2026",
]);

export const PASSWORD_HINT = "Minimal 10 karakter, berisi huruf dan angka, dan bukan kata sandi umum.";

const boundedPassword = z
  .string()
  .min(1, "Kata sandi wajib diisi")
  .max(128, "Email atau kata sandi salah")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Email atau kata sandi salah");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254),
  password: boundedPassword,
});

export const passwordSchema = z
  .string()
  .min(10, "Kata sandi minimal 10 karakter")
  .max(128, "Kata sandi maksimal 128 karakter")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Kata sandi terlalu panjang")
  .refine((value) => /[a-zA-Z]/.test(value), "Kata sandi harus mengandung huruf")
  .refine((value) => /[0-9]/.test(value), "Kata sandi harus mengandung angka")
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), "Kata sandi terlalu umum, pilih yang lain");

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: passwordSchema,
});

export const superadminLoginSchema = z.object({
  email: z.string().email("Email tidak valid").max(254),
  password: boundedPassword,
});
