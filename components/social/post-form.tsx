"use client";

import { PhotoPicker } from "@/components/social/photo-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PostForm({ onSubmit, pending }: { onSubmit: React.FormEventHandler<HTMLFormElement>; pending: boolean }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label htmlFor="post-body" className="sr-only">
        Postingan
      </Label>
      <Textarea id="post-body" name="body" required maxLength={2000} rows={3} placeholder="Bagikan sesuatu ke teman Anda" />
      <PhotoPicker pending={pending} />
    </form>
  );
}
