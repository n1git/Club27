"use client";

import { PhotoPicker } from "@/components/social/photo-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StoryForm({ onSubmit, pending }: { onSubmit: React.FormEventHandler<HTMLFormElement>; pending: boolean }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Cerita terlihat oleh teman Anda selama 24 jam.</p>
      <PhotoPicker pending={pending} name="photo" max={1} submitLabel="Bagikan cerita" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-caption">Teks (opsional)</Label>
        <Input id="story-caption" name="caption" maxLength={200} placeholder="Tulis sesuatu" />
      </div>
    </form>
  );
}
