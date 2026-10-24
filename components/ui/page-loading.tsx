import { PageSkeleton } from "@/components/ui/page-skeleton";

export function PageLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <PageSkeleton />
    </div>
  );
}
