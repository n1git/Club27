"use client";

import { requestOrganizationDeletion } from "@/lib/actions/organization";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteOrganizationForm({ name }: { name: string }) {
  return (
    <ActionForm action={requestOrganizationDeletion} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-name">Ketik nama organisasi: {name}</Label>
        <Input id="confirm-name" name="confirmName" required maxLength={200} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delete-password">Konfirmasi dengan kata sandi Anda</Label>
        <Input id="delete-password" name="confirmPassword" type="password" required maxLength={128} autoComplete="current-password" />
      </div>
      <ActionSubmitButton
        className="w-fit"
        variant="destructive"
        confirmMessage="Hapus organisasi ini? Semua klubnya langsung tidak bisa diakses dan data dihapus permanen setelah 30 hari."
      >
        Hapus organisasi
      </ActionSubmitButton>
    </ActionForm>
  );
}
