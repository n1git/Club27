import { requireRole } from "@/lib/auth/guard";
import { requireModule } from "@/lib/modules";
import { getCheckinOverview } from "@/lib/data/checkin";
import { getLocations } from "@/lib/data/lookups";
import { getClubTerms } from "@/lib/club-type";
import { formatJakartaDate } from "@/lib/format";
import { MetricCard } from "@/components/ui/metric-card";
import { TriggerDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PointsManager } from "@/components/checkin/points-manager";
import { ManualCheckinForm } from "@/components/checkin/manual-checkin-form";
import { VisitTable } from "@/components/checkin/visit-table";
import { LazyHourlyChart } from "@/components/checkin/lazy-hourly-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshOnFocus } from "@/components/shared/refresh-on-focus";

export default async function CheckinPage() {
  await requireRole("admin");
  await requireModule("checkin");
  const [overview, locations, terms] = await Promise.all([
    getCheckinOverview(),
    getLocations(),
    getClubTerms(),
  ]);
  const activePoints = overview.points.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RefreshOnFocus />
        <PageHeader title={<>Check-in</>} />
        <TriggerDialog trigger={<Button type="button">Check-in manual</Button>}>
          <h2 className="mb-4 text-xl font-semibold">Check-in manual</h2>
          <ManualCheckinForm points={activePoints} />
        </TriggerDialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard title={`${terms.visit} hari ini`} value={String(overview.visitsToday)} />
        <MetricCard title={`${terms.visit} minggu ini`} value={String(overview.visitsWeek)} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Titik check-in</h2>
        <PointsManager points={overview.points} locations={locations} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Check-in hari ini</h2>
        <VisitTable rows={overview.today} showMember />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Jam ramai (30 hari terakhir)</h2>
        <LazyHourlyChart data={overview.hourly} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {terms.member} dengan paket aktif tanpa kunjungan 14 hari ({overview.dormant.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{terms.member}</TableHead>
              <TableHead>Kunjungan terakhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.dormant.map((d) => (
              <TableRow key={d.memberId}>
                <TableCell className="font-medium">{d.fullName}</TableCell>
                <TableCell>
                  {d.lastCheckinAt
                    ? formatJakartaDate(d.lastCheckinAt, { day: "numeric", month: "short", year: "numeric" })
                    : "Belum pernah"}
                </TableCell>
              </TableRow>
            ))}
            {overview.dormant.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Semua {terms.member.toLowerCase()} aktif berkunjung.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
