"use client";

import { inviteOwner, transferOwnership } from "@/lib/actions/ownership";
import { ActionForm, useActionFormState } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { InviteLinkNotice } from "@/components/shared/invite-link-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

function ConfirmPassword({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Konfirmasi dengan kata sandi Anda</Label>
      <Input id={id} name="confirmPassword" type="password" required maxLength={128} autoComplete="current-password" />
    </div>
  );
}

function LinkResult() {
  const state = useActionFormState();
  return <InviteLinkNotice link={state.link} message={state.ok ? state.message : undefined} />;
}

export function InviteOwnerForm() {
  return (
    <ActionForm action={inviteOwner} className="flex max-w-md flex-col gap-4">
      <LinkResult />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="owner-name">Nama</Label>
        <Input id="owner-name" name="fullName" required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="owner-email">Email</Label>
        <Input id="owner-email" name="email" type="email" required maxLength={254} />
      </div>
      <ConfirmPassword id="invite-owner-password" />
      <ActionSubmitButton className="w-fit">Undang pemilik</ActionSubmitButton>
    </ActionForm>
  );
}

export function TransferOwnershipForm({ owners }: { owners: { id: string; name: string }[] }) {
  return (
    <ActionForm action={transferOwnership} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transfer-to">Pemilik utama baru</Label>
        <Select id="transfer-to" name="memberId" required defaultValue="">
          <option value="" disabled>
            Pilih pemilik
          </option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>
      <ConfirmPassword id="transfer-password" />
      <ActionSubmitButton
        className="w-fit"
        variant="destructive"
        confirmMessage="Pindahkan kepemilikan utama? Anda tetap menjadi pemilik, tetapi hanya pemilik utama yang baru yang dapat memindahkannya kembali."
      >
        Pindahkan kepemilikan
      </ActionSubmitButton>
    </ActionForm>
  );
}
