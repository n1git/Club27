import { getOwnAvatarUrl } from "@/lib/data/social";
import { getStoryTray } from "@/lib/data/stories";
import { Skeleton } from "@/components/ui/skeleton";
import { StoriesBar } from "./stories-bar";

export async function HomeStories({ accountId, name }: { accountId: string; name: string }) {
  const [groups, avatarUrl] = await Promise.all([getStoryTray(accountId), getOwnAvatarUrl(accountId)]);
  return <StoriesBar groups={groups} me={{ name, avatarUrl }} />;
}

export function StoriesBarSkeleton() {
  return (
    <div role="status" aria-label="Memuat cerita" className="flex gap-3 border-b border-border px-4 py-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex w-[76px] shrink-0 flex-col items-center gap-1">
          <Skeleton className="size-[73px] rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
