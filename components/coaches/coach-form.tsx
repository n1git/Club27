"use client";

import { inviteCoach } from "@/lib/actions/invitations";
import { AccountForm } from "@/components/shared/account-form";

export function CoachForm() {
  return <AccountForm action={inviteCoach} noun="pelatih" />;
}
