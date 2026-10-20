import { z } from "zod";
import { passwordSchema } from "./auth";
import { usernameSchema } from "./username";
import { BILLING_PERIODS, PLAN_CODES, type BillingPeriod, type PlanCode } from "@/lib/pricing";
import { CONSENT_REQUIRED_ERROR } from "@/lib/consent";

const tenantNameSchema = z.string().trim().min(2, "Nama klub minimal 2 karakter").max(100, "Nama klub terlalu panjang");

const clubTypeSchema = z
  .string()
  .regex(/^[a-z_]{2,30}$/, "Jenis klub tidak valid")
  .default("swimming");

export const registerClubSchema = z.object({
  tenantName: tenantNameSchema,
  ownerFullName: z.string().trim().min(2, "Nama Anda minimal 2 karakter").max(100, "Nama terlalu panjang"),
  ownerEmail: z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang"),
  username: usernameSchema,
  password: passwordSchema,
  clubType: clubTypeSchema,
  planCode: z.enum(PLAN_CODES as [PlanCode, ...PlanCode[]], { message: "Pilih paket" }),
  billingPeriod: z.enum(BILLING_PERIODS as [BillingPeriod, ...BillingPeriod[]], { message: "Pilih periode" }),
  estimatedUsers: z.coerce.number().int("Jumlah pengguna tidak valid").min(1, "Minimal 1 pengguna").max(1000, "Jumlah pengguna terlalu besar"),
  acceptTerms: z.literal(true, { message: CONSENT_REQUIRED_ERROR }),
});

export const createTenantSchema = z.object({ tenantName: tenantNameSchema, clubType: clubTypeSchema });
