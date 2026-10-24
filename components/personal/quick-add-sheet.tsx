"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostForm } from "@/components/social/post-form";
import { FriendAddForm } from "@/components/social/friend-add-form";
import { WorkoutForm } from "@/components/workouts/workout-form";
import { useQuickAdd, type QuickKind, type QuickMode } from "./quick-add";

const TITLES: Record<QuickMode, string> = {
  chooser: "Tambah",
  post: "Posting",
  friend: "Tambah teman",
  workout: "Catat latihan",
};

const CHOICES: { kind: QuickKind; label: string; social: boolean }[] = [
  { kind: "post", label: "Posting", social: true },
  { kind: "friend", label: "Tambah teman", social: true },
  { kind: "workout", label: "Catat latihan", social: false },
];

export function QuickAddSheet() {
  const quickAdd = useQuickAdd();
  const ref = useRef<HTMLDialogElement>(null);
  const mode = quickAdd?.mode ?? null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  if (!quickAdd) return null;
  const { canSocial, sports, today, pending, formKeys, submit, setMode, open } = quickAdd;
  const panel = (kind: QuickMode) => cn(mode === kind ? "block" : "hidden");

  return (
    <dialog
      ref={ref}
      aria-label={mode ? TITLES[mode] : "Tambah"}
      onClose={() => setMode(null)}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="menu-sheet m-0 mt-auto max-h-[90dvh] w-dvw max-w-none rounded-t-[var(--radius-frame)] border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-[var(--radius-frame)]"
    >
      <div className="flex max-h-[90dvh] flex-col overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-2">
          <h2 className="text-lg font-semibold">{mode ? TITLES[mode] : "Tambah"}</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => ref.current?.close()}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4">
          <ul className={cn("divide-y divide-border overflow-hidden rounded-[var(--radius-frame)] border border-border", panel("chooser"))}>
            {CHOICES.filter((c) => canSocial || !c.social).map((c) => (
              <li key={c.kind}>
                <button
                  type="button"
                  onClick={() => open(c.kind)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex-1 text-left">{c.label}</span>
                  <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          {canSocial ? (
            <>
              <div className={panel("post")}>
                <PostForm key={formKeys.post} onSubmit={(e) => submit("post", e)} pending={pending.post} />
              </div>
              <div className={panel("friend")}>
                <FriendAddForm key={formKeys.friend} onSubmit={(e) => submit("friend", e)} pending={pending.friend} />
              </div>
            </>
          ) : null}
          <div className={panel("workout")}>
            <WorkoutForm key={formKeys.workout} sports={sports} today={today} onSubmit={(e) => submit("workout", e)} pending={pending.workout} />
          </div>
        </div>
      </div>
    </dialog>
  );
}
