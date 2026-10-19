"use client";

import { updatePlan } from "@/lib/actions/superadmin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PricingPlan } from "@/lib/pricing";

export function PlanEditor({ plan, isActive }: { plan: PricingPlan; isActive: boolean }) {
  return (
    <ActionForm action={updatePlan} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <input type="hidden" name="code" value={plan.code} />
      <span className="w-full font-heading text-base font-semibold">{plan.name}</span>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Harga/pengguna/bulan
        <Input name="pricePerUserMonth" type="number" min={0} step="1000" defaultValue={plan.pricePerUserMonth} className="w-36" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Batas klub (kosong = tak terbatas)
        <Input name="clubLimit" type="number" min={1} defaultValue={plan.clubLimit ?? ""} className="w-28" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Minimal seat
        <Input name="minSeats" type="number" min={1} max={1000} defaultValue={plan.minSeats} className="w-24" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Hari trial
        <Input name="trialDays" type="number" min={0} defaultValue={plan.trialDays} className="w-24" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Bulan gratis (tahunan)
        <Input name="yearlyFreeMonths" type="number" min={0} max={11.5} step="0.5" defaultValue={plan.yearlyFreeMonths} className="w-24" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Status
        <Select name="isActive" defaultValue={String(isActive)} className="w-28">
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </Select>
      </label>
      <ActionSubmitButton size="sm">Simpan paket</ActionSubmitButton>
    </ActionForm>
  );
}
