import Link from "next/link";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BOARD_SIZE,
  METRIC_KEY,
  METRIC_LABEL,
  PERIOD_KEY,
  PERIOD_LABEL,
  PREV_PERIOD_LABEL,
  type BoardMetric,
  type BoardParams,
  type BoardPeriod,
  type BoardRow,
} from "@/lib/data/leaderboards";

const PLACEHOLDER = "Ayo mulai sesimu dan rebut posisi ini.";

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km` : `${m} m`;
}

function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} j ${m} mnt` : `${m} mnt`;
}

function primary(row: BoardRow, metric: BoardMetric) {
  if (metric === "distance") return distance(row.distanceM);
  if (metric === "duration") return duration(row.durationMin);
  return `${row.sessions} sesi`;
}

function secondary(row: BoardRow, metric: BoardMetric) {
  const parts: string[] = [];
  if (metric !== "sessions") parts.push(`${row.sessions} sesi`);
  if (metric !== "distance" && row.distanceM > 0) parts.push(distance(row.distanceM));
  if (metric !== "duration") parts.push(duration(row.durationMin));
  return parts.join(" · ");
}

function pill(active: boolean) {
  return cn(
    "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-accent"
  );
}

export function Leaderboard({
  rows,
  params,
  sports,
  hrefFor,
  emptyHint,
}: {
  rows: BoardRow[];
  params: BoardParams;
  sports: { code: string; label: string }[];
  hrefFor: (patch: { metrik?: string; periode?: string; olahraga?: string | null }) => string;
  emptyHint?: string;
}) {
  const top = rows.filter((r) => r.rank !== null && r.rank <= BOARD_SIZE);
  const outside = rows.find((r) => r.rank !== null && r.rank > BOARD_SIZE) ?? null;
  const pastChampions = rows.filter((r) => r.rank === null && r.prevChampion);
  const placeholders = Math.max(BOARD_SIZE - top.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="group" aria-label="Metrik" className="flex flex-wrap gap-2">
          {(Object.keys(METRIC_LABEL) as BoardMetric[]).map((m) => (
            <Link key={m} href={hrefFor({ metrik: METRIC_KEY[m] })} aria-current={params.metric === m ? "true" : undefined} className={pill(params.metric === m)}>
              {METRIC_LABEL[m]}
            </Link>
          ))}
        </div>
        <div role="group" aria-label="Periode" className="flex flex-wrap gap-2">
          {(Object.keys(PERIOD_LABEL) as BoardPeriod[]).map((p) => (
            <Link key={p} href={hrefFor({ periode: PERIOD_KEY[p] })} aria-current={params.period === p ? "true" : undefined} className={pill(params.period === p)}>
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        {sports.length > 1 ? (
          <div role="group" aria-label="Olahraga" className="flex flex-wrap gap-2">
            <Link href={hrefFor({ olahraga: null })} aria-current={params.sport === null ? "true" : undefined} className={pill(params.sport === null)}>
              Semua olahraga
            </Link>
            {sports.map((s) => (
              <Link key={s.code} href={hrefFor({ olahraga: s.code })} aria-current={params.sport === s.code ? "true" : undefined} className={pill(params.sport === s.code)}>
                {s.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {pastChampions.length ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown aria-hidden className="size-4 shrink-0 text-accent-foreground" />
          Juara {PREV_PERIOD_LABEL[params.period]}: {pastChampions.map((r) => `${r.fullName} (@${r.username})`).join(", ")}
        </p>
      ) : null}

      <ol aria-label="Peringkat" className="flex flex-col gap-2">
        {top.map((row) => (
          <Row key={row.accountId} row={row} metric={params.metric} period={params.period} />
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={`empty-${i}`} className="flex items-center gap-4 rounded-2xl border border-dashed border-border px-4 py-3 text-muted-foreground">
            <span className="w-8 shrink-0 text-right font-display text-2xl leading-none">{top.length + i + 1}</span>
            <span className="text-sm">{PLACEHOLDER}</span>
          </li>
        ))}
      </ol>

      {outside ? (
        <div className="flex flex-col gap-2">
          <p aria-hidden className="text-center text-muted-foreground">
            ···
          </p>
          <ol aria-label="Posisi Anda" className="flex flex-col gap-2">
            <Row row={outside} metric={params.metric} period={params.period} />
          </ol>
        </div>
      ) : null}

      {top.length === 0 && emptyHint ? <p className="text-sm text-muted-foreground">{emptyHint}</p> : null}
    </div>
  );
}

function amount(value: number, metric: BoardMetric) {
  if (metric === "distance") return distance(value);
  if (metric === "duration") return duration(value);
  return `${value} sesi`;
}

function Movement({ row }: { row: BoardRow }) {
  if (row.rank === null) return null;
  if (row.prevRank === null) return <span className="text-xs font-semibold text-muted-foreground">Baru</span>;
  const diff = row.prevRank - row.rank;
  if (diff === 0) return <span className="text-xs text-muted-foreground" aria-label="Posisi tetap">=</span>;
  return diff > 0 ? (
    <span className="text-xs font-semibold text-success" aria-label={`Naik ${diff} peringkat`}>
      ▲{diff}
    </span>
  ) : (
    <span className="text-xs font-semibold text-destructive" aria-label={`Turun ${-diff} peringkat`}>
      ▼{-diff}
    </span>
  );
}

function Row({ row, metric, period }: { row: BoardRow; metric: BoardMetric; period: BoardPeriod }) {
  const detail = secondary(row, metric);
  return (
    <li className={cn("flex items-center gap-4 rounded-2xl px-4 py-3", row.isMe ? "bg-primary/30 dark:bg-primary/15" : "bg-card")}>
      <span className="flex w-8 shrink-0 flex-col items-end gap-0.5">
        <span className="font-display text-2xl leading-none">{row.rank}</span>
        <Movement row={row} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">
          {row.prevChampion ? <Crown aria-label={`Juara ${PREV_PERIOD_LABEL[period]}`} className="mr-1 inline size-4 align-[-2px] text-accent-foreground" /> : null}
          {row.fullName}
          {row.isMe ? <span className="ml-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-bold text-background">Kamu</span> : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">@{row.username}</span>
        {row.isMe && row.gapToNext !== null && row.nextRank !== null ? (
          <span className="text-xs font-medium text-accent-foreground">
            Kurang {amount(row.gapToNext, metric)} lagi untuk naik ke #{row.nextRank}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col items-end text-right">
        <span className="font-semibold tabular-nums">{primary(row, metric)}</span>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </li>
  );
}
