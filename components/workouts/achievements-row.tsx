"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Award } from "lucide-react";
import { shareAchievement } from "@/lib/actions/social";
import { ShareCardButton } from "@/components/shared/share-card-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export interface AchievementItem {
  id: string;
  code: string;
  name: string;
  description: string;
  date: string;
}

export function AchievementsRow({ items, canShare }: { items: AchievementItem[]; canShare: boolean }) {
  const [open, setOpen] = useState<AchievementItem | null>(null);
  const [, start] = useTransition();

  function share(item: AchievementItem) {
    setOpen(null);
    const form = new FormData();
    form.set("achievementId", item.id);
    start(async () => {
      const id = toast.loading("Memproses…");
      const result = await shareAchievement({}, form);
      if (result.ok) toast.success(result.message ?? "Lencana dibagikan ke teman", { id });
      else toast.error(result.error ?? "Gagal membagikan lencana", { id });
    });
  }

  return (
    <>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.id} className="w-40 shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(item)}
              aria-haspopup="dialog"
              className="flex h-full w-full flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-left ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Award size={20} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold leading-tight">{item.name}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{item.description}</span>
              <span className="mt-auto text-[11px] text-muted-foreground">{item.date}</span>
            </button>
          </li>
        ))}
      </ul>

      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title="Lencana">
        {open ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Award size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{open.name}</p>
                <p className="text-xs text-muted-foreground">
                  {open.description} · {open.date}
                </p>
              </div>
            </div>
            {canShare ? (
              <ul className="divide-y divide-border border-t border-border pb-[env(safe-area-inset-bottom)]">
                <li>
                  <button
                    type="button"
                    onClick={() => share(open)}
                    className="flex min-h-12 w-full items-center px-4 text-left text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    Bagikan ke feed teman
                  </button>
                </li>
                <li className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm font-medium">
                  Bagikan sebagai gambar
                  <ShareCardButton href={`/api/cards/badge/${open.id}`} filename={`lencana-${open.code}`} />
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
