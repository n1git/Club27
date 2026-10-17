"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { createSession } from "@/lib/auth/session";
import { listMemberClubs } from "@/lib/data/member-clubs";
import { type ActionState } from "./types";

export async function switchClub(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("member");
  const parsed = z.string().uuid().safeParse(formData.get("tenantId"));
  if (!parsed.success) return { ok: false, error: "Klub tidak valid" };

  const club = (await listMemberClubs(session.account_id)).find((c) => c.tenantId === parsed.data);
  if (!club) return { ok: false, error: "Klub tidak ditemukan atau akses dinonaktifkan" };

  await createSession({
    id: club.profileId,
    accountId: session.account_id,
    email: club.email,
    fullName: club.fullName,
    role: "member",
    tenantId: club.tenantId,
    orgId: club.orgId,
  });

  redirect("/member");
}
