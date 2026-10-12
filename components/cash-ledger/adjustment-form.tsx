"use client";

import { useActionState } from "react";
import { addManualAdjustment } from "@/lib/actions/cash-ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import { RequestIdInput } from "@/components/shared/request-id-input";

export function AdjustmentForm() {
  const [state, formAction, pending] = useActionState(addManualAdjustment, {});
  useActionToast(state, "Penyesuaian berhasil ditambahkan");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <RequestIdInput state={state} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="direction">Jenis</Label>
          <Select id="direction" name="direction" defaultValue="out">
            <option value="in">Uang Masuk</option>
            <option value="out">Uang Keluar</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Jumlah (Rp)</Label>
          <Input id="amount" name="amount" type="number" min={1} step={1} required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Alasan</Label>
        <Textarea id="reason" name="reason" required minLength={3} maxLength={2000} />
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan..." : "Tambah Penyesuaian"}
      </Button>
    </form>
  );
}
