import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" style={style} className={cn("skeleton-sheen relative overflow-hidden rounded-md bg-muted", className)} />;
}
