import { cn } from "@/lib/utils";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground", className)}
    >
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}
