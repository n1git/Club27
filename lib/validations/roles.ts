import { z } from "zod";
import { PERMISSION_CODES } from "@/lib/auth/permissions";

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Nama peran minimal 2 karakter").max(60, "Nama peran maksimal 60 karakter"),
  isPaid: z.boolean(),
  permissions: z.array(z.enum(PERMISSION_CODES)).max(PERMISSION_CODES.length),
});
