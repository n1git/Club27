"use client";

import { Printer } from "lucide-react";
import { addOrderPayment, voidOrder } from "@/lib/actions/orders";
import { PAYMENT_METHODS } from "@/lib/commerce";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { RequestIdInput } from "@/components/shared/request-id-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" className="h-10" onClick={() => window.print()}>
      <Printer className="size-4" />
      Cetak struk
    </Button>
  );
}

export function PaymentForm({ orderId, remaining }: { orderId: string; remaining: number }) {
  return (
    <ActionForm action={addOrderPayment} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <RequestIdInput />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="op-method">Metode</Label>
          <Select id="op-method" name="method" defaultValue="cash" className="h-10">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="op-amount">Jumlah (Rp)</Label>
          <Input id="op-amount" name="amount" type="number" min={1} max={remaining} defaultValue={remaining} required className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="op-ref">Referensi (opsional)</Label>
          <Input id="op-ref" name="reference" maxLength={120} className="h-10" />
        </div>
      </div>
      <ActionSubmitButton className="h-10 w-fit">Catat pembayaran</ActionSubmitButton>
    </ActionForm>
  );
}

export function VoidForm({ orderId, paid }: { orderId: string; paid: boolean }) {
  return (
    <ActionForm action={voidOrder} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`void-reason-${orderId}`}>Alasan pembatalan</Label>
        <Input
          id={`void-reason-${orderId}`}
          name="reason"
          required
          minLength={5}
          maxLength={500}
          className="h-10"
          aria-describedby={`void-reason-hint-${orderId}`}
        />
        <p id={`void-reason-hint-${orderId}`} className="text-xs text-muted-foreground">
          Minimal 5 karakter. Resepsionis hanya bisa membatalkan pesanan yang lunas hari ini.
        </p>
      </div>
      <ActionSubmitButton
        variant="destructive"
        className="h-10 w-fit"
        confirmMessage={
          paid
            ? "Batalkan pesanan ini? Stok dikembalikan dan pembayaran dicatat keluar di Buku Kas."
            : "Batalkan pesanan ini?"
        }
      >
        Batalkan pesanan
      </ActionSubmitButton>
    </ActionForm>
  );
}
