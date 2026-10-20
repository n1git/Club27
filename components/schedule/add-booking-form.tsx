"use client";

import { useActionState, useState } from "react";
import { addBooking } from "@/lib/actions/schedule";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MemberPicker } from "@/components/shared/member-picker";

export function AddBookingForm({
  classId,
  isAdmin,
  classStarted,
}: {
  classId: string;
  isAdmin: boolean;
  classStarted: boolean;
}) {
  const addBookingWithClassId = addBooking.bind(null, classId);
  const [state, formAction, pending] = useActionState(addBookingWithClassId, {});
  const [late, setLate] = useState(classStarted);

  if (classStarted && !isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Kelas sudah dimulai. Hanya admin yang bisa mencatat kehadiran susulan.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        if (
          late &&
          !window.confirm(
            "Catat kehadiran susulan? Aturan kelas yang sudah dimulai dan paket aktif dilewati, dan tindakan ini tercatat di log audit."
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`booking-member-${classId}`}>Daftarkan anggota</Label>
        <MemberPicker id={`booking-member-${classId}`} name="memberId" required />
      </div>
      {isAdmin ? (
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="lateAttendance"
            checked={late}
            onChange={(event) => setLate(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent-foreground"
          />
          <span>
            Catat kehadiran susulan
            <span className="block text-xs text-muted-foreground">
              Untuk kelas yang sudah dimulai atau anggota tanpa paket aktif. Peserta langsung ditandai hadir bila kelas sudah dimulai.
            </span>
          </span>
        </label>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 sm:h-10 sm:self-start">
        {pending ? "Menyimpan..." : late ? "Catat kehadiran" : "Daftarkan"}
      </Button>
    </form>
  );
}
