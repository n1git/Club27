"use client";

import { changeStaffRole } from "@/lib/actions/staff";
import { ActionForm } from "@/components/shared/action-form";
import { Select } from "@/components/ui/select";

export function StaffRoleSelect({
  profileId,
  roleId,
  roles,
}: {
  profileId: string;
  roleId: string;
  roles: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={changeStaffRole}>
      <input type="hidden" name="profileId" value={profileId} />
      <Select
        name="roleId"
        aria-label="Ubah peran"
        defaultValue={roleId}
        className="h-8 w-40"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
    </ActionForm>
  );
}
