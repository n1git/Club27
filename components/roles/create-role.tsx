"use client";

import { createRole } from "@/lib/actions/roles";
import { RoleForm } from "./role-form";
import type { PermissionInfo } from "@/lib/data/roles";

export function CreateRoleForm({ permissions }: { permissions: PermissionInfo[] }) {
  return <RoleForm action={createRole} permissions={permissions} submitLabel="Buat peran" />;
}
