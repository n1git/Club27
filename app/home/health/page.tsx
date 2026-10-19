import { requireRole } from "@/lib/auth/guard";
import { getHealthData } from "@/lib/data/health";
import { formatJakartaDate } from "@/lib/format";
import { MeasurementForm } from "@/components/health/measurement-form";
import { formatMeasure, MeasurementTable } from "@/components/health/measurement-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";

export const unstable_dynamicStaleTime = 0;

const dateLabel = (date: string) => formatJakartaDate(`${date}T00:00:00+07:00`, { dateStyle: "medium" });

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ ubah?: string }> }) {
  await requireRole("personal");
  const [{ ubah }, data] = await Promise.all([searchParams, getHealthData()]);
  const editing = ubah ? data.rows.find((r) => r.id === ubah) : undefined;
  const { latestWeight, bmi, bmiOn } = data.summary;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Kesehatan" subtitle="Tinggi dan berat badan Anda. Hanya Anda yang bisa melihat data ini." />

      <section className="flex flex-col gap-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title="Berat terakhir" value={formatMeasure(latestWeight?.weightKg ?? null, " kg")} />
          <MetricCard title="IMT" value={formatMeasure(bmi)} />
        </div>
        <p className="text-sm text-muted-foreground">
          {latestWeight ? `Berat dari catatan ${dateLabel(latestWeight.measuredOn)}. ` : ""}
          {bmiOn ? `IMT dari catatan ${dateLabel(bmiOn)}.` : "IMT muncul setelah ada catatan dengan tinggi dan berat badan di tanggal yang sama."}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? `Ubah catatan ${dateLabel(editing.measuredOn)}` : "Catat pengukuran"}</CardTitle>
        </CardHeader>
        <CardContent>
          <MeasurementForm key={editing?.id ?? "new"} today={data.today} entry={editing} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Riwayat</h2>
        <MeasurementTable rows={data.rows} />
      </section>
    </div>
  );
}
