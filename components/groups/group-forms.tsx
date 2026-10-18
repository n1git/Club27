"use client";

import { createEvent, createGroup, inviteToGroup } from "@/lib/actions/groups";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function GroupCreateForm() {
  return (
    <ActionForm action={createGroup} className="grid max-w-xl gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name">Nama grup</Label>
        <Input id="group-name" name="name" required minLength={3} maxLength={80} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-desc">Deskripsi (opsional)</Label>
        <Textarea id="group-desc" name="description" maxLength={500} rows={2} />
      </div>
      <ActionSubmitButton className="w-fit">Buat grup</ActionSubmitButton>
    </ActionForm>
  );
}

export function InviteForm({ groupId, friends }: { groupId: string; friends: { id: string; fullName: string; username: string }[] }) {
  if (!friends.length) return <p className="text-sm text-muted-foreground">Semua teman Anda sudah ada di grup ini atau belum ada teman.</p>;
  return (
    <ActionForm action={inviteToGroup} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-friend">Undang teman</Label>
        <Select id="invite-friend" name="accountId" defaultValue={friends[0].id}>
          {friends.map((f) => (
            <option key={f.id} value={f.id}>
              {f.fullName} (@{f.username})
            </option>
          ))}
        </Select>
      </div>
      <ActionSubmitButton>Undang</ActionSubmitButton>
    </ActionForm>
  );
}

export function EventForm({ groupId }: { groupId: string }) {
  return (
    <ActionForm action={createEvent} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="ev-title">Judul event</Label>
        <Input id="ev-title" name="title" required minLength={3} maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-start">Mulai</Label>
        <Input id="ev-start" name="startsAt" type="datetime-local" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-end">Selesai (opsional)</Label>
        <Input id="ev-end" name="endsAt" type="datetime-local" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-location">Lokasi (opsional)</Label>
        <Input id="ev-location" name="location" maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-capacity">Kuota (opsional)</Label>
        <Input id="ev-capacity" name="capacity" type="number" inputMode="numeric" min={1} max={1000} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="ev-desc">Deskripsi (opsional)</Label>
        <Textarea id="ev-desc" name="description" maxLength={1000} rows={2} />
      </div>
      <ActionSubmitButton className="w-fit">Buat event</ActionSubmitButton>
    </ActionForm>
  );
}
