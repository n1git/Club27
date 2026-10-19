import { cn } from "@/lib/utils";

export function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-8", className)}>{children}</div>;
}
