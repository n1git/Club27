import { z } from "zod";

export const PLATFORM_SUBSCRIPTION_STATUSES = ["pending_verification", "pending", "trial", "active", "suspended", "cancelled"] as const;

export type PlatformSubscriptionStatus = (typeof PLATFORM_SUBSCRIPTION_STATUSES)[number];

export const STATUS_LABEL: Record<PlatformSubscriptionStatus, string> = {
  pending_verification: "Menunggu verifikasi email",
  pending: "Menunggu aktivasi",
  trial: "Trial",
  active: "Aktif",
  suspended: "Ditangguhkan",
  cancelled: "Dibatalkan",
};

export const ownerActiveSchema = z.object({
  ownerId: z.string().uuid("Pemilik tidak valid"),
  isActive: z.enum(["true", "false"]),
});

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").optional());

const optionalLimit = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? Number(v) : undefined))
  .pipe(z.number("Batas klub tidak valid").int("Batas klub tidak valid").min(1, "Batas klub minimal 1").max(1000, "Batas klub terlalu besar").optional());

export const activateOrganizationSchema = z.object({
  organizationId: z.string().uuid("Organisasi tidak valid"),
  periodStart: optionalDate,
  periodEnd: optionalDate,
});

export const organizationStatusSchema = z.object({
  organizationId: z.string().uuid("Organisasi tidak valid"),
  status: z.enum(["pending", "trial", "suspended", "cancelled"]),
});

export const extendTrialSchema = z.object({
  organizationId: z.string().uuid("Organisasi tidak valid"),
  trialEndsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
});

export const clubLimitOverrideSchema = z.object({
  organizationId: z.string().uuid("Organisasi tidak valid"),
  clubLimitOverride: optionalLimit,
});

export const planEditSchema = z.object({
  code: z.enum(["standard", "advanced"]),
  pricePerUserMonth: z.coerce.number().nonnegative("Harga tidak valid"),
  clubLimit: optionalLimit,
  trialDays: z.coerce.number().int("Hari trial tidak valid").min(0, "Hari trial tidak valid").max(365, "Hari trial terlalu besar"),
  yearlyFreeMonths: z.coerce.number().min(0, "Bulan gratis tidak valid").max(11.5, "Bulan gratis terlalu besar"),
  isActive: z.enum(["true", "false"]),
});
