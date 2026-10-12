"use client";

import { useState } from "react";
import { submitRenewal } from "@/lib/actions/subscription";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { PeriodToggle, PlanCard } from "@/components/pricing/pricing-picker";
import type { BillingPeriod, PlanCode, PricingPlan } from "@/lib/pricing";

export function RenewalForm({
  plans,
  planCode,
  period,
  users,
}: {
  plans: PricingPlan[];
  planCode: PlanCode;
  period: BillingPeriod;
  users: number;
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>(planCode);
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>(period);

  return (
    <ActionForm action={submitRenewal} className="flex flex-col gap-4">
      <input type="hidden" name="planCode" value={selectedPlan} />
      <input type="hidden" name="billingPeriod" value={selectedPeriod} />
      <PeriodToggle
        period={selectedPeriod}
        onChange={setSelectedPeriod}
        freeMonths={Math.max(...plans.map((p) => p.yearlyFreeMonths))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            period={selectedPeriod}
            users={users}
            selected={plan.code === selectedPlan}
            onSelect={setSelectedPlan}
          />
        ))}
      </div>
      <ActionSubmitButton className="w-fit">Ajukan perpanjangan</ActionSubmitButton>
    </ActionForm>
  );
}
