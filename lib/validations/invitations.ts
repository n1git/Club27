import { z } from "zod";
import { nameField } from "./limits";

const emailField = z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang");

export const staffInviteSchema = z.object({
  fullName: nameField("Nama"),
  email: emailField,
  roleId: z.string().uuid("Pilih peran"),
});

export const coachInviteSchema = z.object({ fullName: nameField("Nama"), email: emailField });

export const ownerInviteSchema = z.object({ fullName: nameField("Nama"), email: emailField });
