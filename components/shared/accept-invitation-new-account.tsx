"use client";

import { acceptInvitationNewAccount } from "@/lib/actions/invitations";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { suggestUsername } from "@/lib/username-suggest";
import { UsernameField } from "@/components/shared/username-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentCheckbox } from "@/components/shared/consent-checkbox";

export function AcceptInvitationNewAccount({ token, email }: { token: string; email: string }) {
  return (
    <ActionForm action={acceptInvitationNewAccount} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <UsernameField defaultValue={suggestUsername(email)} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Kata sandi</Label>
        <Input id="password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
        <p className="text-xs text-muted-foreground">Minimal 10 karakter, berisi huruf dan angka, dan bukan kata sandi umum.</p>
      </div>
      <ConsentCheckbox />
      <ActionSubmitButton className="w-fit">Buat akun dan terima undangan</ActionSubmitButton>
    </ActionForm>
  );
}
