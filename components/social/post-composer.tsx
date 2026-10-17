"use client";

import { createPost } from "@/lib/actions/social";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PostComposer() {
  return (
    <ActionForm action={createPost} className="flex flex-col gap-2">
      <Label htmlFor="post-body" className="sr-only">
        Postingan
      </Label>
      <Textarea id="post-body" name="body" required maxLength={2000} rows={3} placeholder="Bagikan sesuatu ke teman Anda" />
      <ActionSubmitButton className="w-fit">Posting</ActionSubmitButton>
    </ActionForm>
  );
}
