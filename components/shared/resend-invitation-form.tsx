"use client";

import { useActionState } from "react";
import { resendInvitation } from "@/lib/actions/invitations";
import { Button } from "@/components/ui/button";
import { InviteLinkNotice } from "@/components/shared/invite-link-notice";
import { useActionToast } from "@/components/shared/use-action-toast";

export function ResendInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, formAction, pending] = useActionState(resendInvitation, {});
  useActionToast(state, "Undangan dikirim ulang");
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Kirim ulang
      </Button>
      <InviteLinkNotice link={state.link} />
    </form>
  );
}
