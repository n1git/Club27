import { requireRole } from "@/lib/auth/guard";
import { getReadyClubTypes } from "@/lib/club-type";
import { getWorkoutData } from "@/lib/data/workouts";
import { deleteWorkout } from "@/lib/actions/workouts";
import { shareWorkout } from "@/lib/actions/social";
import { ActionButton } from "@/components/shared/action-button";
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

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} km` : `${m} m`;
}

export default async function WorkoutPage() {
  await requireRole("personal");
  const [clubTypes, data] = await Promise.all([getReadyClubTypes(), getWorkoutData()]);
  const sports = clubTypes.map((t) => ({ code: t.code, label: sportLabel(t.name) }));
  const labels = new Map(sports.map((s) => [s.code, s.label]));
  const thisWeek = data.weeks[data.weeks.length - 1];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Latihan" subtitle="Catatan latihan pribadi. Hanya Anda yang bisa melihatnya." />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Sesi minggu ini"
          value={data.weeklyGoal ? `${thisWeek.sessions} / ${data.weeklyGoal}` : thisWeek.sessions}
          spark={data.weeks.map((w) => w.sessions)}
        />
        <MetricCard title="Menit minggu ini" value={thisWeek.minutes.toLocaleString("id-ID")} spark={data.weeks.map((w) => w.minutes)} />
        <MetricCard title="Jarak minggu ini" value={distance(thisWeek.distanceM)} spark={data.weeks.map((w) => w.distanceM)} />
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
                    <ActionButton action={shareWorkout} fields={{ workoutId: log.id }} label="Bagikan" />
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
