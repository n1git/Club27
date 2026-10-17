"use client";

import { addWorkout } from "@/lib/actions/workouts";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function WorkoutForm({ sports, today }: { sports: { code: string; label: string }[]; today: string }) {
  return (
    <ActionForm action={addWorkout} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-sport">Olahraga</Label>
        <Select id="w-sport" name="sport" defaultValue={sports[0]?.code} required>
          {sports.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-date">Tanggal</Label>
        <Input id="w-date" name="performedOn" type="date" defaultValue={today} min="2000-01-01" max={today} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-duration">Durasi (menit)</Label>
        <Input id="w-duration" name="durationMin" type="number" inputMode="numeric" min={1} max={1440} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-distance">Jarak (meter, opsional)</Label>
        <Input id="w-distance" name="distanceM" type="number" inputMode="numeric" min={1} max={1000000} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="w-notes">Catatan (opsional)</Label>
        <Textarea id="w-notes" name="notes" maxLength={2000} rows={3} />
      </div>
      <ActionSubmitButton className="w-fit">Simpan latihan</ActionSubmitButton>
    </ActionForm>
  );
}
