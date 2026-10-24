import { FeedSkeleton } from "@/components/social/post-skeleton";
import { SkelCard, SkelHeader } from "@/components/ui/skeletons";
import { StoriesBarSkeleton } from "./home-stories";

export function HomeSkeleton() {
  return (
    <div className="page-spinner flex flex-col gap-6">
      <div className="hidden sm:block">
        <SkelHeader />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
        <div className="-mx-4 flex min-w-0 flex-col sm:mx-0">
          <StoriesBarSkeleton />
          <FeedSkeleton />
        </div>
        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
          <SkelCard lines={1} />
          <SkelCard lines={2} />
        </div>
      </div>
    </div>
  );
}
