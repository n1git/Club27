import { BrandIcon } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export function LoadingMark({ className }: { className?: string }) {
  return (
    <span className={cn("logo-breathe shrink-0", className)}>
      <BrandIcon className="size-11" />
    </span>
  );
}

export function SkelHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LoadingMark />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-6 w-40 max-w-[60%]" />
        <Skeleton className="h-3.5 w-72 max-w-[85%]" />
      </div>
    </div>
  );
}

export function SkelLine({ avatar = "rounded-xl", size = 40, thumb = false }: { avatar?: string; size?: number; thumb?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className={cn("shrink-0", avatar)} style={{ width: size, height: size }} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      {thumb ? <Skeleton className="size-11 shrink-0 rounded-md" /> : null}
    </div>
  );
}

export function SkelCard({ lines = 3, title = true, className }: { lines?: number; title?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-4", className)}>
      {title ? <Skeleton className="h-4 w-1/3" /> : null}
      {Array.from({ length: lines }, (_, i) => (
        <SkelLine key={i} />
      ))}
    </div>
  );
}

export function SkelPanel({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-5/6" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function SkelStack({ title, children }: { title?: boolean; children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Memuat" className="page-spinner flex flex-col gap-6">
      {title ? <SkelHeader /> : null}
      {children}
    </div>
  );
}

export function SkelRows({ count = 5, size = 44, circle = true, thumb = false }: { count?: number; size?: number; circle?: boolean; thumb?: boolean }) {
  return (
    <div className="-mx-4 flex flex-col divide-y divide-border sm:mx-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-border sm:bg-card">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="px-4 py-3">
          <SkelLine avatar={circle ? "rounded-full" : "rounded-xl"} size={size} thumb={thumb} />
        </div>
      ))}
    </div>
  );
}

export function AuthSkeleton() {
  return (
    <div role="status" aria-label="Memuat" className="page-spinner flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <LoadingMark />
        <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-3/4" />
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function DocSkeleton() {
  return (
    <div role="status" aria-label="Memuat" className="page-spinner mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-6 sm:py-12">
      <div className="flex items-center gap-3">
        <LoadingMark />
        <Skeleton className="h-8 w-64 max-w-[70%]" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}
