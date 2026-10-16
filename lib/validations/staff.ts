import { z } from "zod";
import { nameField, phoneField } from "./limits";
import { usernameSchema } from "./username";

export const staffSchema = z.object({
  fullName: nameField("Nama"),
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang"),
  username: usernameSchema,
  phone: phoneField.optional(),
  roleId: z.string().uuid("Pilih peran"),
});
