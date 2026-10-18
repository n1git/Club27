"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActionPermission } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPermissionCatalog, getTenantRoles, organizationIdForTenant } from "@/lib/data/roles";
import { roleSchema } from "@/lib/validations/roles";
import type { ActionState } from "./types";

async function parseRole(formData: FormData) {
  const catalog = new Map((await getPermissionCatalog()).map((p) => [p.code, p]));
  const parsed = roleSchema.safeParse({
    name: formData.get("name"),
    isPaid: formData.get("isPaid") === "on",
    permissions: formData.getAll("permissions").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" } as const;
  if (parsed.data.permissions.some((code) => catalog.get(code)?.ownerOnly)) {
    return { error: "Permission ini hanya untuk pemilik organisasi" } as const;
  }
  return { data: parsed.data } as const;
}

function revalidateRoles() {
  revalidatePath("/admin/roles");
  revalidatePath("/admin/staff");
  revalidatePath("/admin/coaches");
}

export async function createRole(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("roles.manage");
  const organizationId = await organizationIdForTenant(session.club_id);
  if (!organizationId) return { ok: false, error: "Organisasi tidak ditemukan" };
  const input = await parseRole(formData);
  if ("error" in input) return { ok: false, error: input.error };

  const supabase = createAdminSupabaseClient();
  const { data: role, error } = await supabase
    .from("organization_roles")
    .insert({ organization_id: organizationId, name: input.data.name, is_paid: input.data.isPaid })
    .select("id")
    .single();
  if (error || !role) {
    return { ok: false, error: error?.code === "23505" ? "Nama peran sudah dipakai" : "Gagal membuat peran" };
  }
  if (input.data.permissions.length) {
    const { error: permError } = await supabase
      .from("role_permissions")
      .insert(input.data.permissions.map((code) => ({ role_id: role.id, permission_code: code })));
    if (permError) {
      await supabase.from("organization_roles").delete().eq("id", role.id);
      return { ok: false, error: "Gagal menyimpan permission peran" };
    }
  }
  await logAudit({
    action: "role.create",
    targetType: "role",
    targetId: role.id,
    details: { name: input.data.name, paid: input.data.isPaid, permissions: input.data.permissions.length },
    tenantId: session.club_id,
    organizationId,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidateRoles();
  return { ok: true, message: "Peran dibuat" };
}

export async function updateRole(roleId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("roles.manage");
  const id = z.string().uuid().safeParse(roleId);
  if (!id.success) return { ok: false, error: "Peran tidak valid" };
  const current = (await getTenantRoles(session.club_id)).find((r) => r.id === id.data);
  if (!current) return { ok: false, error: "Peran tidak ditemukan" };
  const input = await parseRole(formData);
  if ("error" in input) return { ok: false, error: input.error };
  if (current.profileCount > 0 && current.isPaid !== input.data.isPaid) {
    return { ok: false, error: "Status berbayar tidak bisa diubah selama peran masih dipakai staf" };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("organization_roles")
    .update({ name: input.data.name, is_paid: input.data.isPaid })
    .eq("id", current.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Nama peran sudah dipakai" : "Gagal menyimpan peran" };

  const next = new Set(input.data.permissions);
  const toRemove = current.permissions.filter((code) => !next.has(code as never));
  const toAdd = input.data.permissions.filter((code) => !current.permissions.includes(code));
  if (toRemove.length) {
    await supabase.from("role_permissions").delete().eq("role_id", current.id).in("permission_code", toRemove);
  }
  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("role_permissions")
      .insert(toAdd.map((code) => ({ role_id: current.id, permission_code: code })));
    if (addError) return { ok: false, error: "Gagal menyimpan permission peran" };
  }
  await logAudit({
    action: "role.update",
    targetType: "role",
    targetId: current.id,
    details: { name: input.data.name, added: toAdd, removed: toRemove },
    tenantId: session.club_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidateRoles();
  return { ok: true, message: "Peran disimpan" };
}

export async function deleteRole(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("roles.manage");
  const id = z.string().uuid().safeParse(formData.get("roleId"));
  if (!id.success) return { ok: false, error: "Peran tidak valid" };
  const current = (await getTenantRoles(session.club_id)).find((r) => r.id === id.data);
  if (!current) return { ok: false, error: "Peran tidak ditemukan" };
  if (current.profileCount > 0) return { ok: false, error: "Peran masih dipakai staf. Pindahkan stafnya dulu." };

  const { error } = await createAdminSupabaseClient().from("organization_roles").delete().eq("id", current.id);
  if (error) return { ok: false, error: "Gagal menghapus peran" };
  await logAudit({
    action: "role.delete",
    targetType: "role",
    targetId: current.id,
    details: { name: current.name },
    tenantId: session.club_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidateRoles();
  return { ok: true, message: "Peran dihapus" };
}
