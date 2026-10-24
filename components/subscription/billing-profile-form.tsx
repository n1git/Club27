"use client";

import { updateBillingProfile } from "@/lib/actions/subscription";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BillingProfileForm({ address, email }: { address: string | null; email: string | null }) {
  return (
    <ActionForm action={updateBillingProfile} className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="billing-address">Alamat penagihan</Label>
        <Textarea id="billing-address" name="billingAddress" rows={3} maxLength={500} defaultValue={address ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="billing-email">Email penagihan</Label>
        <Input id="billing-email" name="billingEmail" type="email" maxLength={200} defaultValue={email ?? ""} />
        <p className="text-xs text-muted-foreground">Kosongkan untuk memakai email pemilik utama.</p>
      </div>
      <ActionSubmitButton className="w-fit">Simpan</ActionSubmitButton>
    </ActionForm>
  );
}
