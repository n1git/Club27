"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { StoryGroup } from "@/lib/data/stories";
import { Avatar } from "@/components/social/avatar";
import { StoryRing } from "@/components/social/story-ring";
import { useQuickAdd } from "./quick-add";
import { StoryViewer } from "./story-viewer";

export function StoriesBar({ groups, me }: { groups: StoryGroup[]; me: { name: string; avatarUrl: string | null } }) {
  const router = useRouter();
  const quickAdd = useQuickAdd();
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [start, setStart] = useState<number | null>(null);
  const mine = groups.find((g) => g.mine);
  const friends = groups.filter((g) => !g.mine);
  const ordered = mine ? [mine, ...friends] : friends;

  const onSeen = useCallback((id: string) => setSeen((s) => (s.has(id) ? s : new Set(s).add(id))), []);
  const isUnseen = (g: StoryGroup) => g.stories.some((s) => !s.seen && !seen.has(s.id));
  const openStory = () => quickAdd?.open("story");

  return (
    <>
      <ul className="flex snap-x gap-3 overflow-x-auto border-b border-border px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Cerita">
        <li className="relative flex w-[76px] shrink-0 snap-start flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => (mine ? setStart(0) : openStory())}
            aria-label={mine ? "Lihat cerita Anda" : "Tambah cerita"}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StoryRing unseen={false} active={Boolean(mine)}>
              <Avatar name={me.name} src={me.avatarUrl} size={64} />
            </StoryRing>
          </button>
          <button
            type="button"
            onClick={openStory}
            aria-label="Tambah cerita"
            className="absolute right-1 top-11 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <span className="w-full truncate text-center text-xs text-muted-foreground">Cerita Anda</span>
        </li>
        {friends.map((g) => (
          <li key={g.person.id} className="flex w-[76px] shrink-0 snap-start flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setStart(ordered.indexOf(g))}
              aria-label={`Lihat cerita ${g.person.fullName}${isUnseen(g) ? ", belum dilihat" : ""}`}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StoryRing unseen={isUnseen(g)}>
                <Avatar name={g.person.fullName} src={g.person.avatarUrl} size={64} />
              </StoryRing>
            </button>
            <span className={isUnseen(g) ? "w-full truncate text-center text-xs font-medium" : "w-full truncate text-center text-xs text-muted-foreground"}>
              {g.person.fullName.split(" ")[0]}
            </span>
          </li>
        ))}
      </ul>
      {start !== null ? (
        <StoryViewer
          groups={ordered.slice(start)}
          seen={seen}
          onSeen={onSeen}
          onClose={(changed) => {
            setStart(null);
            if (changed) router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
