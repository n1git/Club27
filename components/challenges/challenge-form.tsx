"use client";

import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/actions/types";

export function ChallengeForm({
  action,
  groups,
  sports,
  today,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  groups?: { id: string; name: string }[];
  sports: { code: string; label: string }[];
  today: string;
}) {
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      {groups ? (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="c-group">Grup</Label>
          <Select id="c-group" name="groupId" required defaultValue={groups[0]?.id}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="c-name">Nama tantangan</Label>
        <Input id="c-name" name="name" required minLength={3} maxLength={100} placeholder="Contoh: Renang 20 km Oktober" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-metric">Metrik</Label>
        <Select id="c-metric" name="metric" defaultValue="sessions" required>
          <option value="sessions">Jumlah sesi</option>
          <option value="distance">Jarak (km)</option>
          <option value="duration">Durasi (menit)</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-target">Target</Label>
        <Input id="c-target" name="target" inputMode="decimal" required autoComplete="off" placeholder="Sesi, km, atau menit sesuai metrik" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-sport">Olahraga (opsional)</Label>
        <Select id="c-sport" name="sport" defaultValue="">
          <option value="">Semua olahraga</option>
          {sports.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-start">Mulai</Label>
          <Input id="c-start" name="startsOn" type="date" defaultValue={today} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-end">Selesai</Label>
          <Input id="c-end" name="endsOn" type="date" min={today} required />
        </div>
      </div>
      <ActionSubmitButton className="w-fit">Buat tantangan</ActionSubmitButton>
    </ActionForm>
  );
}
