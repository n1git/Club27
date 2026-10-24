import { PostCardSkeleton } from "@/components/social/post-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingMark, SkelCard, SkelHeader, SkelLine, SkelPanel, SkelRows, SkelStack } from "@/components/ui/skeletons";

export function WorkoutsSkeleton() {
  return (
    <SkelStack>
      <div className="hidden sm:block">
        <SkelHeader />
      </div>
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="flex items-center gap-3">
          <LoadingMark />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-5">
              <Skeleton className="size-28 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-4">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-36 w-40 shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 2 }, (_, g) => (
            <div key={g} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
              <SkelLine />
              <SkelLine />
            </div>
          ))}
        </div>
      </div>
    </SkelStack>
  );
}

export function FriendsSkeleton() {
  return (
    <SkelStack title>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SkelCard lines={2} />
        <SkelCard lines={1} />
        <SkelCard lines={3} />
        <SkelCard lines={1} />
      </div>
    </SkelStack>
  );
}

export function NotificationsSkeleton() {
  return (
    <SkelStack>
      <div className="flex max-w-xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <LoadingMark />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-4 w-14" />
        <SkelRows count={3} thumb />
        <Skeleton className="h-4 w-24" />
        <SkelRows count={3} thumb />
      </div>
    </SkelStack>
  );
}

export function MessagesSkeleton() {
  return (
    <SkelStack>
      <div className="flex max-w-xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <LoadingMark />
          <Skeleton className="h-6 w-24" />
        </div>
        <SkelRows count={6} size={52} />
      </div>
    </SkelStack>
  );
}

export function ChatSkeleton() {
  const bubbles = ["w-40", "w-56 self-end", "w-32", "w-48 self-end", "w-44"];
  return (
    <div role="status" aria-label="Memuat" className="fixed inset-0 z-40 flex flex-col bg-background sm:static sm:z-auto sm:h-[calc(100dvh-9rem)] sm:max-w-xl sm:overflow-hidden sm:rounded-xl sm:border sm:border-border">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <LoadingMark />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-4">
        {bubbles.map((w, i) => (
          <Skeleton key={i} className={`h-9 rounded-2xl ${w}`} />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-11 flex-1 rounded-2xl" />
        <Skeleton className="size-11 rounded-full" />
      </div>
    </div>
  );
}

export function GroupsSkeleton() {
  return (
    <SkelStack title>
      <SkelCard lines={2} />
      <SkelCard lines={3} />
      <SkelPanel />
    </SkelStack>
  );
}

export function ChallengesSkeleton() {
  return (
    <SkelStack title>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <SkelPanel />
    </SkelStack>
  );
}

export function HealthSkeleton() {
  return (
    <SkelStack title>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <SkelPanel />
      <SkelCard lines={4} />
    </SkelStack>
  );
}

export function FormCardsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <SkelStack title>
      {Array.from({ length: cards }, (_, i) => (
        <SkelPanel key={i} className="max-w-2xl" />
      ))}
    </SkelStack>
  );
}

export function DetailSkeleton() {
  return (
    <SkelStack title>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SkelCard lines={3} className="lg:col-span-2" />
        <SkelCard lines={2} />
        <SkelCard lines={2} />
      </div>
    </SkelStack>
  );
}

export function PostPageSkeleton() {
  return (
    <div role="status" aria-label="Memuat" className="page-spinner mx-auto max-w-xl">
      <PostCardSkeleton />
    </div>
  );
}

export function ProfileGridSkeleton() {
  return (
    <div role="status" aria-label="Memuat" className="page-spinner flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-5 sm:gap-8">
        <LoadingMark className="[&_img]:size-[88px]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-2 h-4 w-44" />
        </div>
      </div>
      <Skeleton className="h-8 w-48 rounded-md" />
      <div className="-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:gap-1">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none sm:rounded-md" />
        ))}
      </div>
    </div>
  );
}
