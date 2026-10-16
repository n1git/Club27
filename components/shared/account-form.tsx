"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { previewSeatUsage } from "@/lib/actions/subscription";
import type { ActionState } from "@/lib/actions/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import { InviteLinkNotice } from "@/components/shared/invite-link-notice";
import type { SeatUsage } from "@/lib/data/platform-pricing";

export function AccountForm({
  action,
  noun,
  roleOptions,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  noun: string;
  roleOptions?: { value: string; label: string; paid?: boolean }[];
}) {
  const title = `${noun[0].toUpperCase()}${noun.slice(1)}`;
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state, `Undangan ${noun} dibuat`);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [full, setFull] = useState<SeatUsage | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    const chosen = new FormData(event.currentTarget).get("role");
    if (!(roleOptions?.find((o) => o.value === chosen)?.paid ?? false)) return;
    event.preventDefault();
    setChecking(true);
    const usage = await previewSeatUsage();
    setChecking(false);
    if (usage?.full) {
      setFull(usage);
      return;
    }
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
      <InviteLinkNotice link={state.link} message={state.message} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Nama {title}</Label>
        <Input id="fullName" name="fullName" required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
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
      {full ? (
        <Alert variant="warning">
          <AlertTitle>Seat penuh</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Organisasi memakai {full.used} dari {full.seats} seat, jadi peran ini belum bisa ditambahkan. Tambah seat di halaman
              Langganan, atau nonaktifkan pengguna yang tidak diperlukan.
            </span>
            <span className="flex gap-2">
              <Link href="/admin/klub/langganan" className={buttonVariants({ size: "sm" })}>
                Buka Langganan
              </Link>
              <Button type="button" size="sm" variant="outline" onClick={() => setFull(null)}>
                Tutup
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <Button type="submit" disabled={pending || checking} className="w-fit">
          {pending || checking ? "Memproses..." : `Undang ${title}`}
        </Button>
      )}
    </form>
  );
}
