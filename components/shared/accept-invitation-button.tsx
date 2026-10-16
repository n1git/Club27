"use client";

import { acceptInvitationAsCurrent } from "@/lib/actions/invitations";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";

export function AcceptInvitationButton({ token }: { token: string }) {
  return (
    <ActionForm action={acceptInvitationAsCurrent} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <ActionSubmitButton className="w-fit">Terima undangan</ActionSubmitButton>
    </ActionForm>
  );
}
