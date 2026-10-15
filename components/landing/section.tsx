import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  intro,
  className,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className={cn("scroll-mt-20 py-16 sm:py-24", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {eyebrow ? <p className="text-sm font-semibold uppercase tracking-wider text-accent-foreground">{eyebrow}</p> : null}
        <h2 id={`${id}-judul`} className="mt-2 max-w-2xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        {intro ? <div className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">{intro}</div> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
