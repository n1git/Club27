import { requireRole } from "@/lib/auth/guard";
import { getReadyClubTypes } from "@/lib/club-type";
import { getWorkoutData, getWorkoutInsights, weekStartOf } from "@/lib/data/workouts";
import { socialRestriction } from "@/lib/auth/social-access";
import { formatJakartaDate } from "@/lib/format";
import { QuickAddTrigger } from "@/components/personal/quick-add";
import { AchievementsRow } from "@/components/workouts/achievements-row";
import { RecordsRow } from "@/components/workouts/records-row";
import { WeekHero } from "@/components/workouts/week-hero";
import { WorkoutHistory, type HistoryGroup } from "@/components/workouts/workout-history";
import { PageHeader } from "@/components/ui/page-header";

const sportLabel = (name: string) => name.replace(/^Klub\s+/, "");

function pace(minPerKm: number) {
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /km`;
}

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} km` : `${m} m`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function WorkoutPage() {
  const user = await requireRole("personal");
  const [clubTypes, data, restriction] = await Promise.all([getReadyClubTypes(), getWorkoutData(), socialRestriction(user.accountId)]);
  const insights = await getWorkoutInsights(data.weeklyGoal);
  const canShare = restriction === null;
  const labels = new Map(clubTypes.map((t) => [t.code, sportLabel(t.name)]));
  const currentWeek = weekStartOf(data.today);
  const lastWeek = weekStartOf(new Date(Date.parse(`${currentWeek}T00:00:00Z`) - 86400000).toISOString().slice(0, 10));

  const groups: HistoryGroup[] = [];
  for (const log of data.logs) {
    const week = weekStartOf(log.performedOn);
    const title =
      week === currentWeek
        ? "Minggu ini"
        : week === lastWeek
          ? "Minggu lalu"
          : formatJakartaDate(`${log.performedOn}T00:00:00+07:00`, { month: "long", year: "numeric" });
    const entry = {
      id: log.id,
      sport: labels.get(log.sport) ?? log.sport,
      duration: `${log.durationMin} menit`,
      distance: log.distanceM ? distance(log.distanceM) : null,
      date: formatJakartaDate(`${log.performedOn}T00:00:00+07:00`, { weekday: "short", day: "numeric", month: "short" }),
      notes: log.notes,
      performedOn: log.performedOn,
    };
    const last = groups[groups.length - 1];
    if (last?.title === title) last.entries.push(entry);
    else groups.push({ title, entries: [entry] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:block">
        <PageHeader title="Latihan" subtitle="Catatan latihan pribadi. Hanya Anda yang bisa melihatnya." />
      </div>
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Latihan</h1>
          <p className="text-xs text-muted-foreground">Hanya Anda yang bisa melihatnya.</p>
        </div>
        <QuickAddTrigger kind="workout" size="sm">
          Catat latihan
        </QuickAddTrigger>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <WeekHero weeks={data.weeks} goal={data.weeklyGoal} streak={insights.streak} />
          <Section title="Lencana">
            {insights.achievements.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Belum ada lencana. Catat latihan pertama untuk meraih lencana Sesi pertama.
              </p>
            ) : (
              <AchievementsRow
                canShare={canShare}
                items={insights.achievements.map((a) => ({
                  id: a.id,
                  code: a.code,
                  name: a.name,
                  description: a.description,
                  date: formatJakartaDate(`${a.earnedOn}T00:00:00+07:00`, { dateStyle: "medium" }),
                }))}
              />
            )}
          </Section>
          <Section title="Rekor pribadi">
            {insights.records.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Rekor muncul setelah Anda mencatat latihan.</p>
            ) : (
              <RecordsRow
                canShare={canShare}
                items={insights.records.map((r) => ({
                  key: `${r.sport}-${r.year}`,
                  sport: labels.get(r.sport) ?? r.sport,
                  year: r.year,
                  distance: r.longestDistance ? distance(r.longestDistance.meters) : null,
                  duration: r.longestDuration ? `${r.longestDuration.minutes} menit` : null,
                  pace: r.bestPace ? pace(r.bestPace.minPerKm) : null,
                  cardHref: `/api/cards/record/${r.sport}-${r.year}?m=${r.longestDistance ? "distance" : "duration"}`,
                  cardName: `rekor-${r.sport}-${r.year}`,
                }))}
              />
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Riwayat</h2>
            <span className="hidden sm:block">
              <QuickAddTrigger kind="workout" size="sm">
                Catat latihan
              </QuickAddTrigger>
            </span>
          </div>
          {groups.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-5">
              <p className="text-sm text-muted-foreground">Belum ada catatan latihan. Catat sesi pertama Anda, sekecil apa pun.</p>
              <QuickAddTrigger kind="workout" size="sm">
                Catat latihan pertama
              </QuickAddTrigger>
            </div>
          ) : (
            <WorkoutHistory groups={groups} canShare={canShare} />
          )}
        </div>
      </div>
    </div>
  );
}
