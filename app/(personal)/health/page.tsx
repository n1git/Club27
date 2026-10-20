import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isMinorAccount } from "@/lib/auth/social-access";
import { activeHealthConsent } from "@/lib/data/consents";
import { giveHealthConsent } from "@/lib/actions/health";
import { HEALTH_CONSENT_TEXT } from "@/lib/consent";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
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
  const user = await requireRole("personal");
  const [minor, consent] = await Promise.all([isMinorAccount(user.accountId), activeHealthConsent(user.accountId)]);
  if (minor) notFound();
  if (!consent) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Kesehatan" subtitle="Tinggi dan berat badan Anda. Hanya Anda yang bisa melihat data ini." />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Persetujuan data kesehatan</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={giveHealthConsent} className="flex flex-col gap-4">
              <p className="text-sm">{HEALTH_CONSENT_TEXT}</p>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="agree" required className="mt-0.5 size-5 shrink-0 accent-accent-foreground" />
                <span>Saya setuju</span>
              </label>
              <ActionSubmitButton className="w-fit">Setujui dan lanjutkan</ActionSubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    );
  }
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
