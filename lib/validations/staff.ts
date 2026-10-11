import { z } from "zod";
import { nameField, phoneField } from "./limits";
import { usernameSchema } from "./username";
import { STAFF_ROLES } from "@/lib/auth/roles";

export const staffSchema = z.object({
  fullName: nameField("Nama"),
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang"),
  username: usernameSchema,
  phone: phoneField.optional(),
  role: z.enum(STAFF_ROLES, { message: "Pilih peran" }),
});
