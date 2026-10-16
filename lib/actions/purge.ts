"use server";

import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export type PurgeSimulation = { ok: true; organization: string; counts: Record<string, number> } | { ok: false; error: string };

export async function simulatePurge(organizationId: string): Promise<PurgeSimulation> {
  let superadmin: Awaited<ReturnType<typeof requireSuperadminAction>>;
  try {
    superadmin = await requireSuperadminAction();
  } catch {
    return { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };
  }
  const id = z.string().uuid().safeParse(organizationId);
  if (!id.success) return { ok: false, error: "Organisasi tidak valid" };
  const { data, error } = await createAdminSupabaseClient().rpc("purge_organization", { p_org: id.data, p_execute: false });
  if (error || !data) return { ok: false, error: "Simulasi gagal" };
  await logAudit({
    action: "purge.simulate",
    targetType: "organization",
    targetId: id.data,
    organizationId: id.data,
    actorId: superadmin.id,
    actorRole: "superadmin",
  });
  const result = data as { organization: string; counts: Record<string, number> };
  return { ok: true, organization: result.organization, counts: result.counts };
}
