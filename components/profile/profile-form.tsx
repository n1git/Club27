"use client";

import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { UsernameField } from "@/components/shared/username-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/actions/types";

export function ProfileForm({
  action,
  username,
  fullName,
  phone,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  username: string;
  fullName?: string;
  phone?: string | null;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {fullName !== undefined ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-fullName">Nama lengkap</Label>
          <Input id="profile-fullName" name="fullName" required maxLength={200} defaultValue={fullName} autoComplete="name" />
        </div>
      ) : null}
      <UsernameField defaultValue={username} />
      {phone !== undefined ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-phone">Telepon</Label>
          <Input id="profile-phone" name="phone" type="tel" maxLength={30} defaultValue={phone ?? ""} autoComplete="tel" />
        </div>
      ) : null}
      <ActionSubmitButton className="min-h-11 w-fit">Simpan profil</ActionSubmitButton>
    </ActionForm>
  );
}
