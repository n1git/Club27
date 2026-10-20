import Link from "next/link";
import { joinChallenge, leaveChallenge } from "@/lib/actions/challenges";
import { formatChallengeValue, METRIC_NAME, type Challenge, type ChallengeProgressRow } from "@/lib/data/challenges";
import { formatJakartaDate } from "@/lib/format";
import { ActionButton } from "@/components/shared/action-button";

const day = (d: string) => formatJakartaDate(`${d}T00:00:00+07:00`, { day: "numeric", month: "short" });

export function ChallengePeriod({ challenge, sportLabel }: { challenge: Challenge; sportLabel?: string }) {
  return (
    <span>
      {day(challenge.startsOn)} - {day(challenge.endsOn)} · {METRIC_NAME[challenge.metric]} · {sportLabel ?? "Semua olahraga"}
    </span>
  );
}

export function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ChallengeCard({
  challenge,
  progress,
  joined,
  today,
  sportLabel,
  href,
  showJoin = true,
}: {
  challenge: Challenge;
  progress: ChallengeProgressRow[];
  joined: boolean;
  today: string;
  sportLabel?: string;
  href: string;
  showJoin?: boolean;
}) {
  const me = progress.find((p) => p.isMe) ?? null;
  const ended = challenge.endsOn < today;
  const finished = progress.filter((p) => p.done).length;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <Link href={href} className="truncate font-semibold hover:underline">
            {challenge.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            {challenge.scopeName} · <ChallengePeriod challenge={challenge} sportLabel={sportLabel} />
          </span>
        </div>
        {ended ? <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">Selesai</span> : null}
      </div>
      {me ? (
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={me.value} target={challenge.target} />
          <span className="text-sm">
            {formatChallengeValue(me.value, challenge.metric)} / {formatChallengeValue(challenge.target, challenge.metric)}
            {me.done ? " · Selesai" : ""} · #{me.rank} dari {progress.length}
          </span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">
          Target {formatChallengeValue(challenge.target, challenge.metric)} · {progress.length} peserta · {finished} selesai
        </span>
      )}
      {showJoin && !ended ? (
        <div>
          {joined ? (
            <ActionButton action={leaveChallenge} fields={{ challengeId: challenge.id }} label="Keluar" confirmMessage="Keluar dari tantangan ini?" />
          ) : (
            <ActionButton action={joinChallenge} fields={{ challengeId: challenge.id }} label="Ikut tantangan" variant="default" />
          )}
        </div>
      ) : null}
    </li>
  );
}

export function ProgressTable({ challenge, progress }: { challenge: Challenge; progress: ChallengeProgressRow[] }) {
  if (!progress.length) return <p className="text-sm text-muted-foreground">Belum ada peserta.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {progress.map((p) => (
        <li key={p.accountId} className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${p.isMe ? "bg-primary/30 dark:bg-primary/15" : "bg-card"}`}>
          <span className="w-8 shrink-0 text-right font-display text-2xl leading-none">{p.rank}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{p.fullName}</span>
            <span className="truncate text-xs text-muted-foreground">@{p.username}</span>
          </span>
          <span className="flex flex-col items-end text-right">
            <span className="font-semibold tabular-nums">{formatChallengeValue(p.value, challenge.metric)}</span>
            {p.done ? <span className="text-xs font-semibold text-success">Selesai</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
