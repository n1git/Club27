"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Activity, ChevronRight } from "lucide-react";
import { shareWorkout } from "@/lib/actions/social";
import { deleteWorkout } from "@/lib/actions/workouts";
import type { ActionState } from "@/lib/actions/types";
import { cn } from "@/lib/utils";
import { ShareCardButton } from "@/components/shared/share-card-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export interface HistoryEntry {
  id: string;
  sport: string;
  duration: string;
  distance: string | null;
  date: string;
  notes: string | null;
  performedOn: string;
}

export interface HistoryGroup {
  title: string;
  entries: HistoryEntry[];
}

const ROW =
  "flex min-h-12 w-full items-center px-4 text-left text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

export function WorkoutHistory({ groups, canShare }: { groups: HistoryGroup[]; canShare: boolean }) {
  const [open, setOpen] = useState<HistoryEntry | null>(null);
  const [, start] = useTransition();

  function run(action: (prev: ActionState, form: FormData) => Promise<ActionState>, entry: HistoryEntry, done: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setOpen(null);
    const form = new FormData();
    form.set("workoutId", entry.id);
    start(async () => {
      const id = toast.loading("Memproses…");
      const result = await action({}, form);
      if (result.ok) toast.success(result.message ?? done, { id });
      else toast.error(result.error ?? "Gagal memproses", { id });
    });
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.title} aria-labelledby={`hist-${group.title}`}>
            <h3 id={`hist-${group.title}`} className="mb-1.5 text-xs font-semibold text-muted-foreground">
              {group.title}
            </h3>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(entry)}
                    aria-haspopup="dialog"
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                      <Activity size={20} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{entry.sport}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.duration}
                        {entry.distance ? ` · ${entry.distance}` : ""}
                      </span>
                      {entry.notes ? <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{entry.notes}</span> : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                      {entry.date}
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title="Detail latihan">
        {open ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Activity size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{open.sport}</p>
                <p className="text-xs text-muted-foreground">{open.date}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 px-4 pb-4 text-sm">
              <div className="rounded-xl bg-secondary px-3 py-2">
                <dt className="text-xs text-muted-foreground">Durasi</dt>
                <dd className="font-semibold">{open.duration}</dd>
              </div>
              <div className="rounded-xl bg-secondary px-3 py-2">
                <dt className="text-xs text-muted-foreground">Jarak</dt>
                <dd className="font-semibold">{open.distance ?? "-"}</dd>
              </div>
              {open.notes ? (
                <div className="col-span-2 rounded-xl bg-secondary px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Catatan</dt>
                  <dd className="whitespace-pre-wrap break-words">{open.notes}</dd>
                </div>
              ) : null}
            </dl>
            <ul className="divide-y divide-border border-t border-border pb-[env(safe-area-inset-bottom)]">
              {canShare ? (
                <>
                  <li>
                    <button type="button" className={ROW} onClick={() => run(shareWorkout, open, "Latihan dibagikan ke teman")}>
                      Bagikan ke feed teman
                    </button>
                  </li>
                  <li className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm font-medium">
                    Bagikan sebagai gambar
                    <ShareCardButton href={`/api/cards/workout/${open.id}`} filename={`latihan-${open.performedOn}`} />
                  </li>
                </>
              ) : null}
              <li>
                <button type="button" className={cn(ROW, "text-destructive")} onClick={() => run(deleteWorkout, open, "Catatan dihapus", "Hapus catatan ini?")}>
                  Hapus catatan
                </button>
              </li>
            </ul>
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
