"use client";

import { decideClubJoin } from "@/lib/actions/club-join";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Lookup } from "@/lib/data/lookups";
import type { ClubJoinRequest } from "@/lib/data/club-join";
import { formatJakartaDate } from "@/lib/format";

export function DecideForm({ request, coaches }: { request: ClubJoinRequest; coaches: Lookup[] }) {
  return (
    <div className="flex flex-col gap-3">
      <ActionForm action={decideClubJoin} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="approve" value="1" />
        {request.similar.length ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`m-${request.id}`}>Hubungkan ke anggota yang sudah ada</Label>
            <Select id={`m-${request.id}`} name="memberId" defaultValue="">
              <option value="">Buat anggota baru</option>
              {request.similar.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({formatJakartaDate(`${m.dateOfBirth}T00:00:00+07:00`)})
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`c-${request.id}`}>Pelatih (untuk anggota baru)</Label>
          <Select id={`c-${request.id}`} name="coachId" defaultValue="">
            <option value="">Pilih pelatih</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <ActionSubmitButton size="sm">Setujui</ActionSubmitButton>
      </ActionForm>
      <ActionForm action={decideClubJoin}>
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="approve" value="0" />
        <ActionSubmitButton size="sm" variant="outline" confirmMessage="Tolak permintaan ini?">
          Tolak
        </ActionSubmitButton>
      </ActionForm>
    </div>
  );
}
