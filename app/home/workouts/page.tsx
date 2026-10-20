import { requireRole } from "@/lib/auth/guard";
import { getReadyClubTypes } from "@/lib/club-type";
import { getWorkoutData, getWorkoutInsights } from "@/lib/data/workouts";
import { socialRestriction } from "@/lib/auth/social-access";
import { shareAchievement } from "@/lib/actions/social";
import { deleteWorkout } from "@/lib/actions/workouts";
import { shareWorkout } from "@/lib/actions/social";
import { ActionButton } from "@/components/shared/action-button";
import { ShareCardButton } from "@/components/shared/share-card-button";
import { formatJakartaDate } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { GoalForm } from "@/components/workouts/goal-form";
import { WorkoutForm } from "@/components/workouts/workout-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sportLabel = (name: string) => name.replace(/^Klub\s+/, "");

function pace(minPerKm: number) {
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /km`;
}

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} km` : `${m} m`;
}

export default async function WorkoutPage() {
  const user = await requireRole("personal");
  const [clubTypes, data, restriction] = await Promise.all([getReadyClubTypes(), getWorkoutData(), socialRestriction(user.accountId)]);
  const insights = await getWorkoutInsights(data.weeklyGoal);
  const canShare = restriction === null;
  const sports = clubTypes.map((t) => ({ code: t.code, label: sportLabel(t.name) }));
  const labels = new Map(sports.map((s) => [s.code, s.label]));
  const thisWeek = data.weeks[data.weeks.length - 1];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Latihan" subtitle="Catatan latihan pribadi. Hanya Anda yang bisa melihatnya." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Sesi minggu ini"
          value={data.weeklyGoal ? `${thisWeek.sessions} / ${data.weeklyGoal}` : thisWeek.sessions}
          spark={data.weeks.map((w) => w.sessions)}
        />
        <MetricCard title="Menit minggu ini" value={thisWeek.minutes.toLocaleString("id-ID")} spark={data.weeks.map((w) => w.minutes)} />
        <MetricCard title="Jarak minggu ini" value={distance(thisWeek.distanceM)} spark={data.weeks.map((w) => w.distanceM)} />
        <MetricCard title="Streak" value={data.weeklyGoal ? `${insights.streak} mgg` : "-"} />
      </section>
      {!data.weeklyGoal ? <p className="-mt-5 text-sm text-muted-foreground">Atur target mingguan untuk menghitung streak.</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Lencana</CardTitle>
        </CardHeader>
        <CardContent>
          {insights.achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada lencana. Catat latihan pertama untuk meraih lencana Sesi pertama.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {insights.achievements.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.description} · {formatJakartaDate(`${a.earnedOn}T00:00:00+07:00`, { dateStyle: "medium" })}
                    </span>
                  </span>
                  {canShare ? (
                    <span className="flex flex-wrap justify-end gap-2">
                      <ActionButton action={shareAchievement} fields={{ achievementId: a.id }} label="Bagikan ke feed" />
                      <ShareCardButton href={`/api/cards/badge/${a.id}`} filename={`lencana-${a.code}`} />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Rekor pribadi</h2>
        {insights.records.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rekor muncul setelah Anda mencatat latihan.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tahun</TableHead>
                <TableHead>Olahraga</TableHead>
                <TableHead>Jarak terjauh</TableHead>
                <TableHead>Durasi terlama</TableHead>
                <TableHead>Pace terbaik</TableHead>
                {canShare ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.records.map((r) => (
                <TableRow key={`${r.sport}-${r.year}`} className="whitespace-nowrap">
                  <TableCell>{r.year}</TableCell>
                  <TableCell>{labels.get(r.sport) ?? r.sport}</TableCell>
                  <TableCell>{r.longestDistance ? distance(r.longestDistance.meters) : "-"}</TableCell>
                  <TableCell>{r.longestDuration ? `${r.longestDuration.minutes} menit` : "-"}</TableCell>
                  <TableCell>{r.bestPace ? pace(r.bestPace.minPerKm) : "-"}</TableCell>
                  {canShare ? (
                    <TableCell>
                      <ShareCardButton
                        href={`/api/cards/record/${r.sport}-${r.year}?m=${r.longestDistance ? "distance" : "duration"}`}
                        filename={`rekor-${r.sport}-${r.year}`}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Target mingguan</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalForm current={data.weeklyGoal} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catat latihan</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkoutForm sports={sports} today={data.today} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Riwayat</h2>
        {data.logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada catatan latihan.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Olahraga</TableHead>
                <TableHead>Durasi</TableHead>
                <TableHead>Jarak</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatJakartaDate(`${log.performedOn}T00:00:00+07:00`, { dateStyle: "medium" })}</TableCell>
                  <TableCell>{labels.get(log.sport) ?? log.sport}</TableCell>
                  <TableCell>{log.durationMin} menit</TableCell>
                  <TableCell>{log.distanceM ? distance(log.distanceM) : "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">{log.notes ?? ""}</TableCell>
                  <TableCell className="flex gap-2">
                    {canShare ? <ActionButton action={shareWorkout} fields={{ workoutId: log.id }} label="Bagikan" /> : null}
                    {canShare ? <ShareCardButton href={`/api/cards/workout/${log.id}`} filename={`latihan-${log.performedOn}`} /> : null}
                    <ActionForm action={deleteWorkout}>
                      <input type="hidden" name="workoutId" value={log.id} />
                      <ActionSubmitButton variant="destructive" size="sm" confirmMessage="Hapus catatan ini?">
                        Hapus
                      </ActionSubmitButton>
                    </ActionForm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
