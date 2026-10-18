"use client";

import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { UsernameField } from "@/components/shared/username-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/actions/types";

export function ProfileForm({
  action,
  username,
  fullName,
  phone,
  address,
  email,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  username: string;
  fullName?: string;
  phone?: string | null;
  address?: string | null;
  email?: string;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {email !== undefined ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} readOnly disabled />
          <p className="text-xs text-muted-foreground">Email tidak bisa diubah.</p>
        </div>
      ) : null}
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
      {address !== undefined ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-address">Alamat</Label>
          <Textarea id="profile-address" name="address" rows={3} maxLength={500} defaultValue={address ?? ""} autoComplete="street-address" />
        </div>
      ) : null}
      <ActionSubmitButton className="min-h-11 w-fit">Simpan profil</ActionSubmitButton>
    </ActionForm>
  );
}

export function OrganizationNameForm({
  action,
  organizationId,
  name,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  organizationId: string;
  name: string;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`org-name-${organizationId}`}>Nama organisasi</Label>
        <Input id={`org-name-${organizationId}`} name="name" required maxLength={200} defaultValue={name} />
      </div>
      <ActionSubmitButton className="min-h-11 w-fit">Simpan organisasi</ActionSubmitButton>
    </ActionForm>
  );
}

export function CoachProfileForm({
  action,
  profileId,
  specialization,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  profileId: string;
  specialization: string | null;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={profileId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`coach-spec-${profileId}`}>Spesialisasi</Label>
        <Input id={`coach-spec-${profileId}`} name="specialization" maxLength={200} defaultValue={specialization ?? ""} />
      </div>
      <ActionSubmitButton className="min-h-11 w-fit">Simpan profil pelatih</ActionSubmitButton>
    </ActionForm>
  );
}
