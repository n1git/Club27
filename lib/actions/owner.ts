"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerAction } from "@/lib/auth/owner";
import { createSession } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createTenantSchema } from "@/lib/validations/onboarding";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

export async function createTenant(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwnerAction();
  const parsed = createTenantSchema.safeParse({
    tenantName: formData.get("tenantName"),
    clubType: formData.get("clubType") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("create_tenant_for_owner", {
    p_owner_id: owner.ownerId,
    p_tenant_name: parsed.data.tenantName,
    p_club_type: parsed.data.clubType,
  });
  if (error) {
    if (error.message.includes("club type not available")) return { ok: false, error: "Jenis klub belum tersedia" };
    return { ok: false, error: PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal menambah klub" };
  }

  const created = (data as { tenant_id: string; profile_id: string }[] | null)?.[0];
  const { data: profile } = created
    ? await supabase.from("profiles").select("id, email, full_name").eq("id", created.profile_id).maybeSingle()
    : { data: null };
  if (!created || !profile) {
    revalidatePath("/admin/klub");
    return { ok: true, message: "Klub berhasil ditambahkan" };
  }

  await createSession({
    id: profile.id,
    accountId: owner.accountId,
    email: profile.email,
    fullName: profile.full_name,
    role: "owner",
    tenantId: created.tenant_id,
    orgId: owner.organizationId,
  });
  redirect("/admin/onboarding");
}

export async function switchTenant(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwnerAction();
  const parsed = z.string().uuid().safeParse(formData.get("tenantId"));
  if (!parsed.success) return { ok: false, error: "Klub tidak valid" };

  const { data: target } = await createAdminSupabaseClient()
    .from("profiles")
    .select("id, email, full_name, is_active, tenants(is_active)")
    .eq("owner_id", owner.ownerId)
    .eq("tenant_id", parsed.data)
    .maybeSingle();
  const tenant = target?.tenants as unknown as { is_active: boolean } | null;
  if (!target || !target.is_active || !tenant?.is_active) {
    return { ok: false, error: "Klub tidak ditemukan atau sedang dinonaktifkan" };
  }

  await createSession({
    id: target.id,
    accountId: owner.accountId,
    email: target.email,
    fullName: target.full_name,
    role: "owner",
    tenantId: parsed.data,
    orgId: owner.organizationId,
  });

  redirect("/admin");
}
