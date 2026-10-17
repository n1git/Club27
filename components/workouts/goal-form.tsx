"use client";

import { setWeeklyGoal } from "@/lib/actions/workouts";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GoalForm({ current }: { current: number | null }) {
  return (
    <ActionForm action={setWeeklyGoal} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-sessions">Target sesi per minggu</Label>
        <Input id="g-sessions" name="weeklySessions" type="number" inputMode="numeric" min={1} max={21} defaultValue={current ?? undefined} required className="w-32" />
      </div>
      <ActionSubmitButton>Simpan target</ActionSubmitButton>
    </ActionForm>
  );
}
