"use client";

import { useState } from "react";
import { submitRenewal } from "@/lib/actions/subscription";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { PeriodToggle, UsersStepper } from "@/components/pricing/pricing-picker";
import { computeQuote, formatRupiah, type BillingPeriod, type PlanCode, type PricingPlan } from "@/lib/pricing";

export function RenewalForm({
  plans,
  planCode,
  period,
  seats,
  minSeats,
  maxSeats,
  gateway,
}: {
  plans: PricingPlan[];
  planCode: PlanCode;
  period: BillingPeriod;
  seats: number;
  minSeats: number;
  maxSeats: number | null;
  gateway: boolean;
}) {
  const plan = plans.find((p) => p.code === planCode) ?? plans[0];
  const floor = Math.max(minSeats, plan?.minSeats ?? 1, 1);
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>(period);
  const [selectedSeats, setSelectedSeats] = useState(Math.min(Math.max(seats, floor), maxSeats ?? 1000));
  if (!plan) return null;
  const quote = computeQuote(plan, selectedPeriod, selectedSeats);
  const total = formatRupiah(quote.total);

  return (
    <ActionForm action={submitRenewal} className="flex flex-col gap-5">
      <input type="hidden" name="planCode" value={plan.code} />
      <input type="hidden" name="billingPeriod" value={selectedPeriod} />
      <input type="hidden" name="seats" value={quote.users} />
      <PeriodToggle period={selectedPeriod} onChange={setSelectedPeriod} freeMonths={plan.yearlyFreeMonths} />
      <UsersStepper id="renewal-seats" users={selectedSeats} onChange={(n) => setSelectedSeats(Math.min(n, maxSeats ?? 1000))} min={floor} />
      <p className="text-sm">
        {quote.users} seat × {formatRupiah(quote.unitPrice)} × {quote.months} bulan = <strong>{total}</strong>
      </p>
      <ActionSubmitButton className="w-full sm:w-fit">{gateway ? `Bayar ${total}` : `Buat tagihan ${total}`}</ActionSubmitButton>
    </ActionForm>
  );
}
