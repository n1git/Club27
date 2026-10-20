"use client";

import { Dumbbell, Flame, Hand, ThumbsUp, type LucideIcon } from "lucide-react";
import { toggleReaction } from "@/lib/actions/social";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";

const KINDS: { kind: string; label: string; icon: LucideIcon }[] = [
  { kind: "kudos", label: "Kudos", icon: ThumbsUp },
  { kind: "fire", label: "Api", icon: Flame },
  { kind: "strong", label: "Kuat", icon: Dumbbell },
  { kind: "clap", label: "Tepuk tangan", icon: Hand },
];

export function PostReactions({ postId, counts, mine }: { postId: string; counts: Record<string, number>; mine: string | null }) {
  return (
    <div role="group" aria-label="Reaksi" className="flex flex-wrap gap-1.5">
      {KINDS.map(({ kind, label, icon: Icon }) => {
        const active = mine === kind;
        return (
          <ActionForm key={kind} action={toggleReaction}>
            <input type="hidden" name="postId" value={postId} />
            <input type="hidden" name="kind" value={kind} />
            <ActionSubmitButton
              size="sm"
              variant={active ? "secondary" : "outline"}
              aria-pressed={active}
              aria-label={`${active ? "Batalkan" : "Beri"} reaksi ${label}`}
              title={label}
            >
              <Icon aria-hidden className="size-4" />
              <span className="tabular-nums">{counts[kind] ?? 0}</span>
            </ActionSubmitButton>
          </ActionForm>
        );
      })}
    </div>
  );
}
