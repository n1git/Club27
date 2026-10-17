"use client";

import { sendFriendRequest } from "@/lib/actions/social";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FriendAddForm() {
  return (
    <ActionForm action={sendFriendRequest} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="friend-username">Username teman</Label>
        <Input id="friend-username" name="username" required minLength={3} maxLength={30} autoComplete="off" className="w-56" />
      </div>
      <ActionSubmitButton>Tambah teman</ActionSubmitButton>
    </ActionForm>
  );
}
