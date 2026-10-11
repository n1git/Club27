"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTenantAccount } from "@/lib/accounts/create";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { staffSchema } from "@/lib/validations/staff";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

export async function createStaff(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("admin");
  const parsed = staffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone") || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const { role, ...input } = parsed.data;
  const result = await createTenantAccount(session.tenant_id, role, input, "Gagal membuat akun staf");
  if (!result.ok) return result;

  revalidatePath("/admin/staff");
  return { ...result, message: "Staf berhasil ditambahkan" };
}

export async function toggleStaffActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("admin");
  const profileId = String(formData.get("profileId"));
  const isActive = formData.get("isActive") === "true";
  if (profileId === session.sub) {
    return { ok: false, error: "Anda tidak dapat menonaktifkan akun sendiri" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId)
    .is("owner_id", null)
    .in("role", [...STAFF_ROLES])
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: error && PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal memperbarui status staf" };
  }

  revalidatePath("/admin/staff");
  return { ok: true, message: isActive ? "Staf diaktifkan kembali" : "Staf dinonaktifkan" };
}
