"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteStory, listStoryViewers, markStoryViewed, type StoryViewer as Viewer } from "@/lib/actions/stories";
import type { StoryGroup } from "@/lib/data/stories";
import { formatRelativeShort } from "@/lib/format";
import { Avatar } from "@/components/social/avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const HOLD_MS = 200;
const SWIPE_PX = 90;

function firstUnseen(group: StoryGroup, seen: Set<string>) {
  const index = group.stories.findIndex((s) => !s.seen && !seen.has(s.id));
  return index < 0 ? 0 : index;
}

export function StoryViewer({
  groups,
  seen,
  onSeen,
  onClose,
}: {
  groups: StoryGroup[];
  seen: Set<string>;
  onSeen: (id: string) => void;
  onClose: (changed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const changed = useRef(false);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; held: boolean; x: number; y: number } | null>(null);
  const [position, setPosition] = useState(() => ({ g: 0, s: firstUnseen(groups[0], seen) }));
  const [held, setHeld] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const group = groups[position.g];
  const story = group.stories[position.s];
  const loaded = loadedId === story.id;
  const paused = held || viewersOpen || deleting;

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  useEffect(() => {
    if (group.mine || seen.has(story.id) || story.seen) return;
    changed.current = true;
    onSeen(story.id);
    void markStoryViewed(story.id);
  }, [story.id, story.seen, group.mine, seen, onSeen]);

  const close = useCallback(() => dialog.current?.close(), []);

  const next = useCallback(() => {
    setPosition((p) => {
      const current = groups[p.g];
      if (p.s < current.stories.length - 1) return { g: p.g, s: p.s + 1 };
      if (p.g < groups.length - 1) return { g: p.g + 1, s: firstUnseen(groups[p.g + 1], seen) };
      queueMicrotask(close);
      return p;
    });
  }, [groups, seen, close]);

  const prev = useCallback(() => {
    setPosition((p) => {
      if (p.s > 0) return { g: p.g, s: p.s - 1 };
      if (p.g > 0) return { g: p.g - 1, s: 0 };
      return p;
    });
  }, []);

  function openViewers() {
    setViewersOpen(true);
    setViewers(null);
    void listStoryViewers(story.id).then(setViewers);
  }

  async function remove() {
    if (!window.confirm("Hapus cerita ini?")) return;
    setDeleting(true);
    const result = await deleteStory(story.id);
    setDeleting(false);
    if (result.ok) {
      toast.success("Cerita dihapus");
      changed.current = true;
      close();
    } else {
      toast.error(result.error ?? "Gagal menghapus cerita");
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const state = { timer: null as ReturnType<typeof setTimeout> | null, held: false, x: e.clientX, y: e.clientY };
    state.timer = setTimeout(() => {
      state.held = true;
      setHeld(true);
    }, HOLD_MS);
    hold.current = state;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = hold.current;
    if (!state) return;
    const dy = e.clientY - state.y;
    if (dy > SWIPE_PX && dy > Math.abs(e.clientX - state.x)) {
      if (state.timer) clearTimeout(state.timer);
      hold.current = null;
      setHeld(false);
      close();
    }
  }

  function endPress(e: React.PointerEvent<HTMLDivElement>, tap: boolean) {
    const state = hold.current;
    hold.current = null;
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    if (state.held) {
      setHeld(false);
      return;
    }
    if (!tap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  }

  const nextStory = group.stories[position.s + 1] ?? groups[position.g + 1]?.stories[0];

  return (
    <dialog
      ref={dialog}
      aria-label={`Cerita ${group.person.fullName}`}
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose(changed.current);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="relative mx-auto h-full w-full select-none overflow-hidden sm:max-w-[min(100%,calc(100dvh*9/16))]">
        <img
          key={story.id}
          ref={(el) => {
            if (el?.complete && el.naturalWidth) setLoadedId(story.id);
          }}
          src={story.url}
          alt={story.caption ?? `Cerita ${group.person.fullName}`}
          onLoad={() => setLoadedId(story.id)}
          className="size-full object-contain"
          draggable={false}
        />
        {nextStory ? <link rel="preload" as="image" href={nextStory.url} /> : null}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endPress(e, true)}
          onPointerCancel={(e) => endPress(e, false)}
          className="absolute inset-0 touch-none"
          aria-hidden="true"
        />
        <button type="button" className="sr-only" onClick={prev}>
          Cerita sebelumnya
        </button>
        <button type="button" className="sr-only" onClick={next}>
          Cerita berikutnya
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex gap-1 px-3" role="progressbar" aria-label="Posisi cerita" aria-valuemin={1} aria-valuemax={group.stories.length} aria-valuenow={position.s + 1}>
            {group.stories.map((s, i) => (
              <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                {i < position.s ? (
                  <span className="block size-full bg-white" />
                ) : i === position.s && loaded ? (
                  <span
                    key={`${position.g}-${s.id}`}
                    onAnimationEnd={next}
                    style={{ animationPlayState: paused ? "paused" : "running" }}
                    className="story-bar-fill block size-full bg-white"
                  />
                ) : null}
              </span>
            ))}
          </div>
          <div className="pointer-events-auto mt-2 flex items-center gap-3 px-3">
            <Link href={`/${group.person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={group.person.fullName} src={group.person.avatarUrl} size={36} />
              <span className="min-w-0 truncate text-sm font-semibold">{group.mine ? "Cerita Anda" : group.person.fullName}</span>
              <span className="shrink-0 text-xs text-white/75" suppressHydrationWarning>
                {formatRelativeShort(story.createdAt)}
              </span>
            </Link>
            {group.mine ? (
              <button type="button" aria-label="Hapus cerita" onClick={remove} className="flex size-11 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Trash2 size={20} aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" aria-label="Tutup cerita" onClick={close} className="flex size-11 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        </div>

        {story.caption || group.mine ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12">
            {story.caption ? <p className="break-words text-center text-sm">{story.caption}</p> : null}
            {group.mine ? (
              <button
                type="button"
                onClick={openViewers}
                className="pointer-events-auto flex min-h-11 w-fit items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Eye size={18} aria-hidden="true" />
                Dilihat oleh {story.viewCount}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <BottomSheet open={viewersOpen} onClose={() => setViewersOpen(false)} title="Dilihat oleh" className="text-foreground">
        <ul className="flex min-h-40 flex-col gap-3 p-4">
          {viewers === null ? <li className="py-6 text-center text-sm text-muted-foreground">Memuat…</li> : null}
          {viewers?.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">Belum ada yang melihat.</li> : null}
          {viewers?.map((v) => (
            <li key={v.id} className="flex items-center gap-3">
              <Avatar name={v.fullName} src={v.avatarUrl} size={40} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-semibold">{v.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">@{v.username}</p>
              </div>
              <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                {formatRelativeShort(v.viewedAt)}
              </span>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </dialog>
  );
}
