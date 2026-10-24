import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton() {
  return (
    <div className="border-b border-border pb-3 sm:overflow-hidden sm:rounded-xl sm:border sm:bg-card sm:pb-4">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="flex gap-1 px-2 pt-1">
        <Skeleton className="m-2 size-7 rounded-full" />
        <Skeleton className="m-2 size-7 rounded-full" />
      </div>
      <div className="flex flex-col gap-2 px-4">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat postingan" className="flex flex-col">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}
