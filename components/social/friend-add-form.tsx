"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FriendAddForm({ onSubmit, pending }: { onSubmit: React.FormEventHandler<HTMLFormElement>; pending: boolean }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="friend-username">Username teman</Label>
        <Input id="friend-username" name="username" required minLength={3} maxLength={30} autoComplete="off" />
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Menambahkan…" : "Tambah teman"}
      </Button>
    </form>
  );
}
