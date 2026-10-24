"use client";

import { updateBillingIssuer } from "@/lib/actions/superadmin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface IssuerValues {
  name: string;
  address: string;
  email: string | null;
  website: string | null;
  footer: string | null;
}

export function BillingIssuerForm({ issuer }: { issuer: IssuerValues }) {
  return (
    <ActionForm action={updateBillingIssuer} className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuer-name">Nama penerbit</Label>
        <Input id="issuer-name" name="name" required maxLength={200} defaultValue={issuer.name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuer-address">Alamat</Label>
        <Textarea id="issuer-address" name="address" required rows={3} maxLength={500} defaultValue={issuer.address} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issuer-email">Email penagihan</Label>
          <Input id="issuer-email" name="email" type="email" maxLength={200} defaultValue={issuer.email ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issuer-website">Website</Label>
          <Input id="issuer-website" name="website" maxLength={200} defaultValue={issuer.website ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuer-footer">Catatan kaki</Label>
        <Textarea id="issuer-footer" name="footer" rows={2} maxLength={500} defaultValue={issuer.footer ?? ""} />
      </div>
      <ActionSubmitButton className="w-fit">Simpan</ActionSubmitButton>
    </ActionForm>
  );
}
