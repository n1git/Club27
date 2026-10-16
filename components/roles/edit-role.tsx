"use client";

import { updateRole } from "@/lib/actions/roles";
import { RoleForm } from "./role-form";
import type { PermissionInfo } from "@/lib/data/roles";

export function EditRoleForm({
  roleId,
  permissions,
  initial,
  lockPaid,
}: {
  roleId: string;
  permissions: PermissionInfo[];
  initial: { name: string; isPaid: boolean; permissions: string[] };
  lockPaid: boolean;
}) {
  return (
    <RoleForm
      action={updateRole.bind(null, roleId)}
      permissions={permissions}
      initial={initial}
      lockPaid={lockPaid}
      submitLabel="Simpan peran"
    />
  );
}
