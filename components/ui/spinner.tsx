import { cn } from "@/lib/utils";

export function Spinner({ className, label = "Memuat" }: { className?: string; label?: string | null }) {
  return (
    <span
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
      className={cn("spinner inline-block size-5 shrink-0 rounded-full border-2 border-border border-t-accent-foreground", className)}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="page-spinner flex min-h-[50vh] flex-1 items-center justify-center">
      <Spinner className="size-8 border-[3px]" />
    </div>
  );
}
