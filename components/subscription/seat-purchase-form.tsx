"use client";

import { useEffect, useState } from "react";
import { previewSeatPurchase, submitSeatPurchase, type SeatPurchasePreview } from "@/lib/actions/subscription";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/lib/pricing";

export function SeatPurchaseForm({ seats, gateway }: { seats: number; gateway: boolean }) {
  const [add, setAdd] = useState(1);
  const [preview, setPreview] = useState<SeatPurchasePreview | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewSeatPurchase(add);
      if (!cancelled) setPreview(result);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [add]);

  return (
    <ActionForm action={submitSeatPurchase} className="flex flex-col gap-3">
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="add-seats">Tambah seat</Label>
        <Input
          id="add-seats"
          name="seats"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          value={add}
          onChange={(event) => setAdd(Math.max(Math.floor(Number(event.target.value)) || 1, 1))}
          required
        />
      </div>
      {preview && "error" in preview ? (
        <p className="text-sm text-destructive">{preview.error}</p>
      ) : preview ? (
        <p className="text-sm">
          {seats} → {preview.seatsAfter} seat, prorata {preview.remainingDays} hari: <strong>{formatRupiah(preview.amount)}</strong>
        </p>
      ) : null}
      <ActionSubmitButton className="w-full sm:w-fit" disabled={!preview || "error" in preview}>
        {preview && !("error" in preview) ? `${gateway ? "Bayar" : "Buat tagihan"} ${formatRupiah(preview.amount)}` : gateway ? "Bayar" : "Buat tagihan"}
      </ActionSubmitButton>
    </ActionForm>
  );
}
