"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createTenantAccount } from "@/lib/accounts/create";
import { setStaffProfileActive, setStaffProfileRole } from "@/lib/accounts/staff-seat";
import { staffSchema } from "@/lib/validations/staff";
import type { ActionState } from "./types";

export async function createStaff(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("staff.manage");
  const parsed = staffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone") || undefined,
    roleId: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const { roleId, ...input } = parsed.data;
  const result = await createTenantAccount(session.tenant_id, roleId, input, "Gagal membuat akun staf");
  if (!result.ok) return result;

  revalidatePath("/admin/staff");
  return { ...result, message: "Staf berhasil ditambahkan" };
}

export async function toggleStaffActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("staff.manage");
  const profileId = String(formData.get("profileId"));
  const isActive = formData.get("isActive") === "true";
  if (profileId === session.sub) {
    return { ok: false, error: "Anda tidak dapat menonaktifkan akun sendiri" };
  }
  const failure = await setStaffProfileActive(session.tenant_id, profileId, isActive);
  if (failure) return { ok: false, error: failure };

  revalidatePath("/admin/staff");
  return { ok: true, message: isActive ? "Staf diaktifkan kembali" : "Staf dinonaktifkan" };
}

const changeRoleSchema = z.object({ profileId: z.string().uuid(), roleId: z.string().uuid("Pilih peran") });

export async function changeStaffRole(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("staff.manage");
  const parsed = changeRoleSchema.safeParse({ profileId: formData.get("profileId"), roleId: formData.get("roleId") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  if (parsed.data.profileId === session.sub) return { ok: false, error: "Anda tidak dapat mengubah peran sendiri" };

  const failure = await setStaffProfileRole(session.tenant_id, parsed.data.profileId, parsed.data.roleId, false);
  if (failure) return { ok: false, error: failure };

  revalidatePath("/admin/staff");
  return { ok: true, message: "Peran diperbarui" };
}
