import { cn } from "@/lib/utils";

export function Spinner({ className, label = "Memuat" }: { className?: string; label?: string | null }) {
  return (
    <span
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
      className={cn("spinner inline-block size-5 shrink-0 rounded-full border-2 border-border border-t-accent-foreground", className)}
    />
  );
}
