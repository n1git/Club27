"use client";

import { inviteStaff } from "@/lib/actions/invitations";
import { AccountForm } from "@/components/shared/account-form";

export function StaffForm({ roles }: { roles: { id: string; name: string; isPaid: boolean }[] }) {
  const options = roles.map((r) => ({ value: r.id, label: r.isPaid ? `${r.name} (berbayar)` : r.name, paid: r.isPaid }));
  return <AccountForm action={inviteStaff} noun="staf" roleOptions={options} />;
}
