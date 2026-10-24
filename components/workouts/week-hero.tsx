import { Flame, Target } from "lucide-react";
import type { WeekSummary } from "@/lib/data/workouts";
import { cn } from "@/lib/utils";
import { GoalForm } from "./goal-form";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} km` : `${m} m`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dd className="text-lg font-semibold tabular-nums leading-tight">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

export function WeekHero({ weeks, goal, streak }: { weeks: WeekSummary[]; goal: number | null; streak: number }) {
  const current = weeks[weeks.length - 1];
  const progress = goal ? Math.min(1, current.sessions / goal) : 0;
  const reached = Boolean(goal) && current.sessions >= (goal ?? 0);
  const peak = Math.max(1, ...weeks.map((w) => w.sessions));

  return (
    <section aria-labelledby="week-title" className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="week-title" className="text-sm font-semibold">
          Minggu ini
        </h2>
        {goal ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame size={14} aria-hidden="true" />
            Streak {streak} mgg
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-5">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true" focusable="false">
            <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="8" className="stroke-secondary" />
            {goal ? (
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
              />
            ) : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums leading-none">{current.sessions}</span>
            <span className="mt-1 text-xs text-muted-foreground">{goal ? `dari ${goal} sesi` : "sesi"}</span>
          </div>
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-1 gap-3">
          <Stat label="menit berlatih" value={current.minutes.toLocaleString("id-ID")} />
          <Stat label="jarak" value={distance(current.distanceM)} />
        </dl>
      </div>

      {reached ? <p className="-mt-1 text-sm font-medium">Target minggu ini tercapai.</p> : null}

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Sesi 4 minggu terakhir</p>
        <ul className="grid grid-cols-4 items-end gap-3" aria-label="Sesi per minggu">
          {weeks.map((w, i) => {
            const last = i === weeks.length - 1;
            return (
              <li key={w.weekStart} className="flex flex-col items-center gap-1.5">
                <span className="text-xs font-medium tabular-nums">{w.sessions}</span>
                <span className="flex h-14 w-full items-end rounded-lg bg-secondary">
                  <span
                    className={cn("w-full rounded-lg", last ? "bg-primary" : "bg-foreground/25")}
                    style={{ height: `${Math.max(6, (w.sessions / peak) * 100)}%` }}
                  />
                </span>
                <span className="text-[11px] text-muted-foreground">{last ? "Ini" : `-${weeks.length - 1 - i} mgg`}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <details className="group border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Target size={16} aria-hidden="true" />
          {goal ? `Target ${goal} sesi per minggu` : "Atur target mingguan"}
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Ubah</span>
        </summary>
        <div className="pt-2">
          <GoalForm current={goal} />
        </div>
      </details>
    </section>
  );
}
