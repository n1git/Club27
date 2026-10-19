"use client";

import { useState } from "react";
import { submitRenewal } from "@/lib/actions/subscription";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { PeriodToggle, PlanCard } from "@/components/pricing/pricing-picker";
import type { BillingPeriod, PlanCode, PricingPlan } from "@/lib/pricing";

export function RenewalForm({
  plans,
  planCode,
  period,
  seats,
  minSeats,
  maxSeats,
}: {
  plans: PricingPlan[];
  planCode: PlanCode;
  period: BillingPeriod;
  seats: number;
  minSeats: number;
  maxSeats: number | null;
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>(planCode);
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>(period);
  const [selectedSeats, setSelectedSeats] = useState(seats);
  const floor = Math.max(minSeats, plans.find((p) => p.code === selectedPlan)?.minSeats ?? 1, 1);

  return (
    <ActionForm action={submitRenewal} className="flex flex-col gap-4">
      <input type="hidden" name="planCode" value={selectedPlan} />
      <input type="hidden" name="billingPeriod" value={selectedPeriod} />
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="renewal-seats">Jumlah seat</Label>
        <Input
          id="renewal-seats"
          name="seats"
          type="number"
          inputMode="numeric"
          min={floor}
          max={maxSeats ?? 1000}
          value={selectedSeats}
          onChange={(event) => setSelectedSeats(Math.max(Number(event.target.value) || floor, 1))}
          required
        />
        <p className="text-xs text-muted-foreground">
          Minimal {floor} (pengguna aktif saat ini dan minimal paket).
          {maxSeats !== null ? ` Menambah seat saat langganan berjalan lewat Tambah seat di bawah.` : ""}
        </p>
      </div>
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
            users={selectedSeats}
            selected={plan.code === selectedPlan}
            onSelect={setSelectedPlan}
          />
        ))}
      </div>
      <ActionSubmitButton className="w-fit">Ajukan perpanjangan</ActionSubmitButton>
    </ActionForm>
  );
}
