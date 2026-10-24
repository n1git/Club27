import { cn } from "@/lib/utils";

export function StoryRing({ unseen, active = true, children, className }: { unseen: boolean; active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex rounded-full p-[2.5px]", !active ? "bg-transparent" : unseen ? "" : "bg-border", className)}
      style={
        active && unseen
          ? { background: "linear-gradient(45deg, color-mix(in srgb, var(--primary) 62%, #e65100), var(--primary) 48%, color-mix(in srgb, var(--primary) 70%, #ffffff))" }
          : undefined
      }
    >
      <span className="inline-flex rounded-full bg-background p-[2px]">{children}</span>
    </span>
  );
}
