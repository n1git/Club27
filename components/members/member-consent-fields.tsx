"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isMinor, PRIVACY_VERSION } from "@/lib/privacy";

export function MemberConsentFields({ dateOfBirth }: { dateOfBirth: string }) {
  const minor = Boolean(dateOfBirth) && isMinor(dateOfBirth);
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">Persetujuan</legend>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consentMemberData" required className="mt-0.5 size-5 shrink-0 accent-accent-foreground" />
        <span>
          Anggota atau walinya menyetujui data ini dicatat dan dipakai klub sesuai{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            Kebijakan Privasi
          </Link>{" "}
          (versi {PRIVACY_VERSION}).
        </span>
      </label>
      {minor ? (
        <>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="consentGuardian" required className="mt-0.5 size-5 shrink-0 accent-accent-foreground" />
            <span>Anggota berusia di bawah 18 tahun. Orang tua atau wali sudah memberi persetujuan.</span>
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guardianName">Nama orang tua/wali yang memberi persetujuan</Label>
            <Input id="guardianName" name="guardianName" required minLength={2} maxLength={200} />
          </div>
        </>
      ) : null}
    </fieldset>
  );
}
