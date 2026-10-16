"use client";

import { createStaff } from "@/lib/actions/staff";
import { AccountForm } from "@/components/shared/account-form";

export function StaffForm({ roles }: { roles: { id: string; name: string; isPaid: boolean }[] }) {
  const options = roles.map((r) => ({ value: r.id, label: r.isPaid ? `${r.name} (berbayar)` : r.name, paid: r.isPaid }));
  return <AccountForm action={createStaff} noun="staf" roleOptions={options} />;
}
