"use client";

import { requestClubJoin } from "@/lib/actions/club-join";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function JoinForm({ fullName, today }: { fullName: string; today: string }) {
  return (
    <ActionForm action={requestClubJoin} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="join-code">Kode klub</Label>
        <Input id="join-code" name="code" required minLength={3} maxLength={60} autoComplete="off" placeholder="Minta kode ke admin klub" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="join-name">Nama lengkap</Label>
        <Input id="join-name" name="fullName" required minLength={2} maxLength={200} defaultValue={fullName} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="join-dob">Tanggal lahir</Label>
        <Input id="join-dob" name="dateOfBirth" type="date" required min="1900-01-01" max={today} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="join-phone">Telepon (opsional)</Label>
        <Input id="join-phone" name="phone" type="tel" maxLength={30} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="join-message">Pesan untuk klub (opsional)</Label>
        <Textarea id="join-message" name="message" maxLength={300} rows={2} />
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="acceptPrivacy" required className="mt-1" />
        <span>Saya setuju klub mencatat data saya sebagai anggota sesuai Kebijakan Privasi.</span>
      </label>
      <ActionSubmitButton className="w-fit">Kirim permintaan</ActionSubmitButton>
    </ActionForm>
  );
}
