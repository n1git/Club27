"use client";

import { useActionState } from "react";
import { activateMemberAccount, resetMemberPassword } from "@/lib/actions/member-accounts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { TempPasswordNotice } from "@/components/shared/temp-password-notice";
import { UsernameField } from "@/components/shared/username-field";

export function MemberPortalAccess({ memberId, hasAccount }: { memberId: string; hasAccount: boolean }) {
  const [activation, activateAction, activating] = useActionState(activateMemberAccount, {});
  const [reset, resetAction, resetting] = useActionState(resetMemberPassword, {});

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-base font-semibold">Akses portal anggota</h3>
        <p className="text-sm text-muted-foreground">
          Anggota login di halaman masuk untuk melihat langganan, tagihan, dan jadwalnya. Hanya baca.
        </p>
      </div>

      {activation.error ? (
        <Alert variant="destructive">
          <AlertDescription>{activation.error}</AlertDescription>
        </Alert>
      ) : null}
      {activation.ok && activation.message ? (
        <Alert variant="success">
          <AlertDescription>{activation.message}</AlertDescription>
        </Alert>
      ) : null}
      <TempPasswordNotice password={activation.tempPassword} />

      {reset.error ? (
        <Alert variant="destructive">
          <AlertDescription>{reset.error}</AlertDescription>
        </Alert>
      ) : null}
      <TempPasswordNotice password={reset.tempPassword} />

      {hasAccount ? (
        <form action={resetAction} className="flex flex-col gap-2">
          <input type="hidden" name="memberId" value={memberId} />
          <p className="text-sm">Akun portal sudah aktif.</p>
          <ActionSubmitButton
            variant="outline"
            className="w-fit"
            disabled={resetting}
            confirmMessage="Atur ulang kata sandi anggota? Kata sandi lama langsung tidak berlaku dan semua sesinya keluar."
          >
            {resetting ? "Memproses..." : "Atur ulang kata sandi"}
          </ActionSubmitButton>
        </form>
      ) : (
        <form action={activateAction} className="flex flex-col gap-3">
          <input type="hidden" name="memberId" value={memberId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`portal-email-${memberId}`}>Email akun anggota</Label>
            <Input id={`portal-email-${memberId}`} name="email" type="email" required autoComplete="off" />
            <p className="text-xs text-muted-foreground">
              Jika email ini sudah punya akun di klub lain, akun yang sama dipakai dan kata sandinya tidak berubah.
            </p>
          </div>
          <UsernameField emailName="email" error={activation.fieldErrors?.username} />
          <Button type="submit" disabled={activating} className="w-fit">
            {activating ? "Memproses..." : "Aktifkan akun"}
          </Button>
        </form>
      )}
    </section>
  );
}
