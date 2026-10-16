"use client";

import { createOrganizationFromAccount } from "@/lib/actions/organization";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatRupiah, PERIOD_LABEL, type PricingPlan } from "@/lib/pricing";

export function CreateOrganizationForm({
  plans,
  clubTypes,
}: {
  plans: PricingPlan[];
  clubTypes: { code: string; name: string }[];
}) {
  return (
    <ActionForm action={createOrganizationFromAccount} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-name">Nama klub pertama</Label>
        <Input id="org-name" name="tenantName" required minLength={2} maxLength={100} />
      </div>
      {clubTypes.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-type">Jenis klub</Label>
          <Select id="org-type" name="clubType" defaultValue={clubTypes[0].code}>
            {clubTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-plan">Paket</Label>
        <Select id="org-plan" name="planCode" defaultValue={plans[0]?.code}>
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} · {formatRupiah(p.pricePerUserMonth)}/seat/bulan{p.trialDays > 0 ? ` · gratis ${p.trialDays} hari` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-period">Periode</Label>
        <Select id="org-period" name="billingPeriod" defaultValue="monthly">
          {(Object.keys(PERIOD_LABEL) as (keyof typeof PERIOD_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {PERIOD_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-1" />
        <span>Saya menyetujui Syarat &amp; Ketentuan dan Kebijakan Privasi.</span>
      </label>
      <ActionSubmitButton className="w-fit">Buat organisasi</ActionSubmitButton>
    </ActionForm>
  );
}
