import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 80},${28 - ((v - min) / span) * 24 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 80 28" className={cn("h-8 w-24 shrink-0", className)} aria-hidden="true" focusable="false">
      <polygon points={`0,28 ${points} 80,28`} fill="currentColor" opacity="0.12" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  delta,
  deltaLabel,
  spark,
  className,
}: {
  title: string;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  spark?: number[];
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className={cn("truncate tabular-nums", typeof value === "string" && /[A-Za-z]{4,}/.test(value) ? "text-2xl font-semibold tracking-tight" : "font-display text-4xl leading-none")}>{value}</p>
          {delta !== undefined ? (
            <p className={cn("mt-1 flex items-center gap-1 text-xs", up ? "text-success" : "text-destructive")}>
              {up ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
              <span>
                {up ? "Naik" : "Turun"} {Math.abs(delta).toLocaleString("id-ID")}%
              </span>
              {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
            </p>
          ) : null}
        </div>
        {spark ? <Sparkline values={spark} className={delta === undefined ? "text-accent-foreground" : up ? "text-success" : "text-destructive"} /> : null}
      </CardContent>
    </Card>
  );
}
