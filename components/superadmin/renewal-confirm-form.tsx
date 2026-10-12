"use client";

import { confirmRenewalPayment } from "@/lib/actions/superadmin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";

export function RenewalConfirmForm({ renewalId, amount }: { renewalId: string; amount: string }) {
  return (
    <ActionForm action={confirmRenewalPayment} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="renewalId" value={renewalId} />
      <Input name="reference" placeholder="No. referensi (opsional)" maxLength={200} className="w-48" aria-label="Nomor referensi pembayaran" />
      <ActionSubmitButton size="sm" confirmMessage={`Pembayaran ${amount} sudah diterima? Langganan langsung aktif.`}>
        Konfirmasi
      </ActionSubmitButton>
    </ActionForm>
  );
}
