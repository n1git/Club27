import { z } from "zod";
import { parseJakartaLocalInput } from "@/lib/format";
import { uuidField } from "./social";

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Waktu tidak valid");

export const groupSchema = z.object({
  name: z.string().trim().min(3, "Nama grup minimal 3 karakter").max(80, "Nama grup maksimal 80 karakter"),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional(),
});

export const eventSchema = z
  .object({
    groupId: uuidField,
    title: z.string().trim().min(3, "Judul minimal 3 karakter").max(100, "Judul maksimal 100 karakter"),
    description: z.string().trim().max(1000, "Deskripsi maksimal 1.000 karakter").optional(),
    location: z.string().trim().max(200, "Lokasi maksimal 200 karakter").optional(),
    startsAt: localDateTime,
    endsAt: localDateTime.optional(),
    capacity: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.number().int("Kuota harus bilangan bulat").min(1, "Kuota minimal 1").max(1000, "Kuota maksimal 1.000").optional()
    ),
  })
  .refine((v) => new Date(parseJakartaLocalInput(v.startsAt)).getTime() > Date.now(), {
    message: "Waktu mulai harus di masa depan",
    path: ["startsAt"],
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { message: "Waktu selesai harus setelah waktu mulai", path: ["endsAt"] });

export const rsvpSchema = z.object({ eventId: uuidField, status: z.enum(["going", "maybe", "declined"]) });
