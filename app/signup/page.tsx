import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { captchaSiteKey } from "@/lib/captcha";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { RegisterClubForm } from "@/components/shared/register-club-form";
import { APP_NAME } from "@/lib/config";
import { pageMetadata } from "@/lib/seo";
import { getActivePlans } from "@/lib/data/platform-pricing";
import { getReadyClubTypes } from "@/lib/club-type";
import { BILLING_PERIODS, PLAN_CODES, trialLabel, type BillingPeriod, type PlanCode } from "@/lib/pricing";

export const metadata: Metadata = pageMetadata({
  title: "Daftarkan klub",
  description: `Daftarkan klub olahraga Anda di ${APP_NAME}, lalu pilih jenis klub, paket, dan periode langganan.`,
  path: "/signup",
});

export default async function RegisterClubPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; period?: string; users?: string; verifikasi?: string; jenis?: string }>;
}) {
  const [params, plans, clubTypes, requestHeaders] = await Promise.all([
    searchParams,
    getActivePlans(),
    getReadyClubTypes(),
    headers(),
  ]);
  const plan = PLAN_CODES.find((code) => code === params.plan) ?? plans[0]?.code ?? "plus";
  const period: BillingPeriod = BILLING_PERIODS.find((value) => value === params.period) ?? "monthly";
  const minSeats = plans.find((p) => p.code === plan)?.minSeats ?? 1;
  const users = Math.min(Math.max(Math.floor(Number(params.users)) || minSeats, minSeats), 1000);
  const trial = plans.find((p) => p.trialDays > 0);

  return (
    <AuthPageShell
      wide
      title="Daftarkan klub Anda"
      description={
        trial
          ? `Pilih paket, lalu buat akun pemilik. Trial gratis ${trialLabel(trial.trialDays)} tidak perlu kartu kredit.`
          : "Pilih paket, lalu buat akun pemilik."
      }
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            Masuk
          </Link>
          {" · "}
          Belum punya klub?{" "}
          <Link href="/signup/account" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            Buat akun gratis
          </Link>
        </>
      }
    >
      {params.verifikasi === "gagal" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Tautan verifikasi tidak valid atau sudah kedaluwarsa. Daftar ulang dengan email yang sama untuk mendapat tautan baru.
          </AlertDescription>
        </Alert>
      ) : null}
      <RegisterClubForm
        plans={plans}
        initialPlan={plan as PlanCode}
        initialPeriod={period}
        initialUsers={users}
        clubTypes={clubTypes}
        initialClubType={params.jenis}
        captchaSiteKey={captchaSiteKey()}
        nonce={requestHeaders.get("x-nonce") ?? undefined}
      />
    </AuthPageShell>
  );
}
