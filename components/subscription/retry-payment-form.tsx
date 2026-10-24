"use client";

import { retryRenewalPayment } from "@/lib/actions/subscription";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";

export function RetryPaymentForm({ label }: { label: string }) {
  return (
    <ActionForm action={retryRenewalPayment}>
      <ActionSubmitButton className="w-full sm:w-fit">{label}</ActionSubmitButton>
    </ActionForm>
  );
}
