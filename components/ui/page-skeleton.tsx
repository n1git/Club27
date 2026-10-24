import { BrandIcon } from "@/components/shared/brand-logo";
import { Skeleton } from "./skeleton";

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Memuat" className="page-spinner mx-auto flex min-h-[50vh] w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="logo-breathe shrink-0">
          <BrandIcon className="size-11" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48 max-w-[60%]" />
          <Skeleton className="h-3.5 w-72 max-w-[85%]" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl sm:h-24" />
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
