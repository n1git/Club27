"use client";

import { retryRenewalPayment } from "@/lib/actions/subscription";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";

export function RetryPaymentForm() {
  return (
    <ActionForm action={retryRenewalPayment}>
      <ActionSubmitButton size="sm" className="w-fit">
        Buat tautan pembayaran
      </ActionSubmitButton>
    </ActionForm>
  );
}
