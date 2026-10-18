"use client";

import { deleteOwnAccount } from "@/lib/actions/account-delete";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountForm() {
  return (
    <ActionForm action={deleteOwnAccount} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="del-password">Kata sandi</Label>
        <Input id="del-password" name="confirmPassword" type="password" required maxLength={128} autoComplete="current-password" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="del-confirm">Ketik HAPUS</Label>
        <Input id="del-confirm" name="confirmText" required autoComplete="off" />
      </div>
      <ActionSubmitButton variant="destructive" className="w-fit" confirmMessage="Hapus akun beserta semua data sosial dan latihan Anda secara permanen?">
        Hapus akun
      </ActionSubmitButton>
    </ActionForm>
  );
}
