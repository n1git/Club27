"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { computeQuote, formatRupiah, PERIOD_LABEL, type BillingPeriod, type PlanCode, type PricingPlan } from "@/lib/pricing";
import { PeriodToggle, PlanCard } from "@/components/pricing/pricing-picker";
import { TurnstileWidget } from "@/components/shared/turnstile-widget";
import { UsernameField } from "@/components/shared/username-field";

export function RegisterClubForm({
  plans,
  initialPlan,
  initialPeriod,
  initialUsers,
  clubTypes,
  captchaSiteKey,
  nonce,
}: {
  plans: PricingPlan[];
  initialPlan: PlanCode;
  initialPeriod: BillingPeriod;
  initialUsers: number;
  clubTypes: { code: string; name: string }[];
  captchaSiteKey?: string | null;
  nonce?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [planCode, setPlanCode] = useState<PlanCode>(initialPlan);
  const [period, setPeriod] = useState<BillingPeriod>(initialPeriod);
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  const plan = plans.find((p) => p.code === planCode) ?? plans[0];

  if (!plan) {
    return <p className="text-sm text-muted-foreground">Pendaftaran belum dibuka. Coba lagi nanti.</p>;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/onboarding/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantName: formData.get("tenantName"),
        ownerFullName: formData.get("ownerFullName"),
        ownerEmail: formData.get("ownerEmail"),
        username: formData.get("username"),
        password: formData.get("password"),
        planCode: plan.code,
        billingPeriod: period,
        estimatedUsers: users,
        clubType: formData.get("clubType") || undefined,
        captchaToken: captchaToken || undefined,
        acceptTerms: formData.get("acceptTerms") === "on",
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setUsernameError(data.field === "username" ? data.error : undefined);
      setError(data.error ?? "Gagal mendaftarkan klub");
      setLoading(false);
      return;
    }

    if (data.status === "check_email") {
      setSentTo(String(formData.get("ownerEmail") ?? ""));
      setLoading(false);
      return;
    }

    router.push(data.redirectTo);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div role="status" className="flex max-w-md flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
        <p className="text-base font-semibold">Cek email Anda</p>
        <p>
          Kami mengirim tautan verifikasi ke <span className="font-medium">{sentTo}</span>. Buka tautan itu dalam 24 jam
          untuk menyelesaikan pendaftaran dan masuk ke klub Anda.
        </p>
        <p className="text-muted-foreground">
          Tidak menerima email? Periksa folder spam, atau daftar ulang dengan email yang sama untuk mendapat tautan baru.
        </p>
      </div>
    );
  }

  const quote = computeQuote(plan, period, users);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        Langkah {step} dari 2: {step === 1 ? "Pilih paket" : "Data pemilik dan klub"}
      </p>

      {step === 1 ? (
        <div className="flex flex-col gap-6">
          <PeriodToggle period={period} onChange={setPeriod} freeMonths={Math.max(...plans.map((p) => p.yearlyFreeMonths))} />
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((p) => (
              <PlanCard
                key={p.code}
                plan={p}
                period={period}
                users={users}
                onUsersChange={setUsers}
                selected={p.code === plan.code}
                onSelect={setPlanCode}
              />
            ))}
          </div>
          <Button type="button" className="w-fit" onClick={() => setStep(2)}>
            Lanjut
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className={cn("flex max-w-sm flex-col gap-4 transition-opacity duration-300", loading && "opacity-50")}
        >
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">
              {plan.name} · {PERIOD_LABEL[period]}
            </p>
            <p className="text-muted-foreground">
              {formatRupiah(quote.total)}/{period === "yearly" ? "tahun" : "bulan"} untuk {quote.users} pengguna.
              {plan.trialDays > 0
                ? ` Gratis ${plan.trialDays} hari pertama.`
                : " Paket aktif setelah pembayaran diterima admin platform."}
            </p>
            <button
              type="button"
              className="mt-1 font-medium text-accent-foreground underline-offset-4 hover:underline"
              onClick={() => setStep(1)}
            >
              Ubah paket
            </button>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantName">Nama klub</Label>
            <Input id="tenantName" name="tenantName" required maxLength={100} autoComplete="organization" />
          </div>
          {clubTypes.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clubType">Jenis klub</Label>
              <Select id="clubType" name="clubType" defaultValue={clubTypes[0].code}>
                {clubTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerFullName">Nama Anda</Label>
            <Input id="ownerFullName" name="ownerFullName" required maxLength={100} autoComplete="name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerEmail">Email</Label>
            <Input id="ownerEmail" name="ownerEmail" type="email" required autoComplete="email" />
          </div>
          <UsernameField emailName="ownerEmail" error={usernameError} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Kata sandi</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-xs text-muted-foreground">
              Minimal 10 karakter, berisi huruf dan angka, dan bukan kata sandi umum.
            </p>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-5 shrink-0 accent-primary" />
            <span>
              Saya menyetujui{" "}
              <a href="/syarat" target="_blank" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                Syarat & Ketentuan
              </a>{" "}
              dan{" "}
              <a href="/privasi" target="_blank" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                Kebijakan Privasi
              </a>
              .
            </span>
          </label>
          {captchaSiteKey ? <TurnstileWidget siteKey={captchaSiteKey} nonce={nonce} onToken={onCaptcha} /> : null}
          <Button type="submit" disabled={loading || Boolean(captchaSiteKey && !captchaToken)}>
            {loading ? "Mendaftarkan..." : "Daftarkan klub"}
          </Button>
        </form>
      )}
    </div>
  );
}
