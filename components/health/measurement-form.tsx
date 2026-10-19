"use client";

import Link from "next/link";
import { addMeasurement, updateMeasurement } from "@/lib/actions/health";
import type { Measurement } from "@/lib/data/health";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MeasurementForm({ today, entry }: { today: string; entry?: Measurement }) {
  return (
    <ActionForm action={entry ? updateMeasurement : addMeasurement} className="grid max-w-2xl gap-4 sm:grid-cols-3">
      {entry ? <input type="hidden" name="measurementId" value={entry.id} /> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-date">Tanggal</Label>
        <Input id="h-date" name="measuredOn" type="date" defaultValue={entry?.measuredOn ?? today} min="1900-01-01" max={today} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-height">Tinggi badan (cm)</Label>
        <Input id="h-height" name="heightCm" type="number" inputMode="decimal" step="0.1" min={50} max={250} defaultValue={entry?.heightCm ?? undefined} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-weight">Berat badan (kg)</Label>
        <Input id="h-weight" name="weightKg" type="number" inputMode="decimal" step="0.1" min={20} max={300} defaultValue={entry?.weightKg ?? undefined} />
      </div>
      <p className="text-sm text-muted-foreground sm:col-span-3">Isi tinggi, berat, atau keduanya. Satu catatan per tanggal.</p>
      <div className="flex flex-wrap gap-2 sm:col-span-3">
        <ActionSubmitButton className="w-fit">{entry ? "Simpan perubahan" : "Simpan catatan"}</ActionSubmitButton>
        {entry ? (
          <Link href="/home/health" className={buttonVariants({ variant: "outline" })}>
            Batal
          </Link>
        ) : null}
      </div>
    </ActionForm>
  );
}
