"use client";

import { useActionState, useRef, useState } from "react";
import { previewInternalUserCost } from "@/lib/actions/subscription";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import { TempPasswordNotice } from "@/components/shared/temp-password-notice";
import { UsernameField } from "@/components/shared/username-field";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import type { InternalUserCostChange } from "@/lib/data/platform-pricing";

export function AccountForm({
  action,
  noun,
  roleOptions,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  noun: string;
  roleOptions?: { value: string; label: string }[];
}) {
  const title = `${noun[0].toUpperCase()}${noun.slice(1)}`;
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state, `${title} berhasil ditambahkan`);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [change, setChange] = useState<InternalUserCostChange | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    setChecking(true);
    const preview = await previewInternalUserCost();
    setChecking(false);
    if (!preview) {
      confirmed.current = true;
      formRef.current?.requestSubmit();
      return;
    }
    setChange(preview);
  }

  function confirm() {
    setChange(null);
    confirmed.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <TempPasswordNotice password={state.tempPassword} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Nama {title}</Label>
        <Input id="fullName" name="fullName" required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <UsernameField emailName="email" error={state.fieldErrors?.username} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Telepon</Label>
        <Input id="phone" name="phone" maxLength={30} />
      </div>
      {roleOptions ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Peran</Label>
          <Select id="role" name="role" required defaultValue="">
            <option value="" disabled>
              Pilih peran
            </option>
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {change ? (
        <Alert variant="warning">
          <AlertTitle>Biaya langganan akan naik</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Menambah {noun} menambah satu pengguna internal ({change.usersBefore} → {change.usersAfter}). Paket{" "}
              {change.planName} ({PERIOD_LABEL[change.period]}): {formatRupiah(change.perMonthBefore)}/bulan menjadi{" "}
              {formatRupiah(change.perMonthAfter)}/bulan, naik {formatRupiah(change.perMonthAfter - change.perMonthBefore)}/bulan.
            </span>
            <span className="flex gap-2">
              <Button type="button" size="sm" onClick={confirm}>
                Ya, tambahkan
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setChange(null)}>
                Batal
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <Button type="submit" disabled={pending || checking} className="w-fit">
          {pending || checking ? "Memproses..." : `Tambah ${title}`}
        </Button>
      )}
    </form>
  );
}
