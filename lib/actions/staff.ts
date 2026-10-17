"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { setStaffProfileActive, setStaffProfileRole } from "@/lib/accounts/staff-seat";
import type { ActionState } from "./types";

export async function toggleStaffActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("staff.manage");
  const profileId = String(formData.get("profileId"));
  const isActive = formData.get("isActive") === "true";
  if (profileId === session.sub) {
    return { ok: false, error: "Anda tidak dapat menonaktifkan akun sendiri" };
  }
  const failure = await setStaffProfileActive(session.club_id, profileId, isActive);
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

  const failure = await setStaffProfileRole(session.club_id, parsed.data.profileId, parsed.data.roleId, false);
  if (failure) return { ok: false, error: failure };

  revalidatePath("/admin/staff");
  return { ok: true, message: "Peran diperbarui" };
}
