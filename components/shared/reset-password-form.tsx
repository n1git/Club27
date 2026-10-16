"use client";

import { useActionState } from "react";
import { resetUserPassword } from "@/lib/actions/accounts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { InviteLinkNotice } from "@/components/shared/invite-link-notice";

export function ResetPasswordForm({ profileId, label }: { profileId: string; label: string }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <InviteLinkNotice link={state.link} message={state.ok ? state.message : undefined} />
      <ActionSubmitButton
        variant="outline"
        className="w-fit"
        disabled={pending}
        confirmMessage={`Buat tautan atur ulang kata sandi ${label}? Tautan baru menggantikan tautan lama.`}
      >
        {pending ? "Memproses..." : `Kirim tautan atur ulang ${label}`}
      </ActionSubmitButton>
    </form>
  );
}
