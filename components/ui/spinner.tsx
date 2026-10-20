import { cn } from "@/lib/utils";

export function Spinner({ className, label = "Memuat" }: { className?: string; label?: string | null }) {
  return (
    <span
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
      className={cn("spinner inline-block size-5 shrink-0 rounded-full border-2 border-border border-t-accent-foreground", className)}
    />
  );
}

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
  const outer = i % 5 ? 94 : 98;
  const point = (r: number) => ({ x: (100 + Math.cos(angle) * r).toFixed(2), y: (100 + Math.sin(angle) * r).toFixed(2) });
  const from = point(88);
  const to = point(outer);
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, delay: ((i / 60) * 1.44).toFixed(3) };
});

export function PageSpinner() {
  return (
    <div className="page-spinner flex min-h-[50vh] flex-1 items-center justify-center">
      <div role="status" aria-label="Memuat" className="flex flex-col items-center gap-4">
        <div className="relative size-32">
          <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 size-full">
            {TICKS.map((t, i) => (
              <line key={`base-${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className="stroke-border" strokeWidth={3} strokeLinecap="round" />
            ))}
            {TICKS.map((t, i) => (
              <line
                key={`lit-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                className="loader-tick-lit stroke-accent-foreground"
                strokeWidth={3}
                strokeLinecap="round"
                style={{ animationDelay: `${t.delay}s` }}
              />
            ))}
            <circle cx={100} cy={100} r={70} fill="none" strokeWidth={8} strokeLinecap="round" className="loader-arc stroke-accent-foreground" />
          </svg>
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-[54px] leading-none">
            <span>R</span>
          </span>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">Memuat...</p>
      </div>
    </div>
  );
}
