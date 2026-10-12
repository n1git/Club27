import { requireOwner } from "@/lib/auth/owner";
import { getModules, getOrganizationBilling, listInternalUsers } from "@/lib/data/platform-pricing";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import { STATUS_LABEL } from "@/lib/validations/superadmin";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { RenewalForm } from "@/components/subscription/renewal-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPendingRenewal } from "@/lib/billing/renewals";
import { isBillingLocked } from "@/lib/billing/access";
import { getContact } from "@/lib/site";
import { ModuleList } from "@/components/pricing/pricing-picker";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

const STATUS_VARIANT = {
  pending_verification: "secondary",
  pending: "secondary",
  trial: "warning",
  active: "success",
  expired: "destructive",
  suspended: "destructive",
  cancelled: "secondary",
} as const;

export default async function SubscriptionPage() {
  const owner = await requireOwner();
  const [billing, users, modules, renewal] = await Promise.all([
    getOrganizationBilling(owner.organizationId),
    listInternalUsers(owner.organizationId),
    getModules(),
    getPendingRenewal(owner.organizationId),
  ]);
  if (!billing) return <p className="text-sm text-muted-foreground">Langganan belum tersedia.</p>;

  const { subscription, plan, quote } = billing;
  const periodUnit = subscription.billingPeriod === "yearly" ? "tahun" : "bulan";
  const locked = isBillingLocked({
    status: subscription.status,
    trial_ends_at: subscription.trialEndsAt,
    current_period_end: subscription.currentPeriodEnd,
  });
  const contact = getContact();
  const longDate = { day: "numeric", month: "long", year: "numeric" } as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <PageHeader title={<>Langganan</>} />
        <Badge variant={STATUS_VARIANT[subscription.status]}>{STATUS_LABEL[subscription.status]}</Badge>
      </div>

      {locked ? (
        <Alert variant="warning">
          <AlertTitle>Akses klub dikunci</AlertTitle>
          <AlertDescription>
            Langganan organisasi belum aktif atau sudah berakhir. Semua data tetap tersimpan. Ajukan perpanjangan di
            bawah; akses klub terbuka kembali setelah pembayaran dikonfirmasi.
          </AlertDescription>
        </Alert>
      ) : (
        <SubscriptionBanner />
      )}

      {renewal ? (
        <Alert>
          <AlertTitle>Menunggu pembayaran</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span>
              {renewal.planName ?? renewal.planCode} · {PERIOD_LABEL[renewal.billingPeriod]} · {renewal.users} pengguna ·{" "}
              <strong>{formatRupiah(renewal.amount)}</strong>, diajukan{" "}
              {formatJakartaDate(renewal.requestedAt, longDate)}.
            </span>
            <span>
              Lakukan pembayaran lalu kirim bukti ke admin platform
              {contact.email ? ` (${contact.email})` : ""}
              {contact.whatsapp ? `${contact.email ? " atau" : ""} WhatsApp +${contact.whatsapp}` : ""}. Periode baru
              dimulai setelah periode berjalan habis, atau hari konfirmasi bila sudah lewat.
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Paket" value={`${plan.name} · ${PERIOD_LABEL[subscription.billingPeriod]}`} />
        <MetricCard title="Pengguna internal" value={String(billing.internalUsers)} />
        <MetricCard
          title="Klub"
          value={billing.clubLimit !== null ? `${billing.clubs} / ${billing.clubLimit}` : `${billing.clubs} (tak terbatas)`}
        />
        <MetricCard title={`Total per ${periodUnit}`} value={formatRupiah(quote.total)} />
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        {quote.users} pengguna × {formatRupiah(quote.unitPrice)} × {quote.months.toLocaleString("id-ID")} bulan ={" "}
        {formatRupiah(quote.total)}
        {subscription.billingPeriod === "yearly" ? `, setara ${formatRupiah(quote.perMonth)}/bulan` : ""}.
        {subscription.currentPeriodEnd
          ? ` Periode berjalan sampai ${formatJakartaDate(subscription.currentPeriodEnd, longDate)}.`
          : ""}
        {subscription.status === "trial" && subscription.trialEndsAt
          ? ` Trial sampai ${formatJakartaDate(subscription.trialEndsAt, longDate)}.`
          : ""}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pengguna internal</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Klub</TableHead>
              <TableHead>Biaya/bulan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.key}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>{user.roleLabel}</TableCell>
                <TableCell>{user.clubName ?? "Semua klub"}</TableCell>
                <TableCell>{formatRupiah(quote.unitPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Akun admin Anda di setiap klub dihitung satu kali. Anggota dan akun nonaktif tidak dihitung.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Perpanjang atau ganti paket</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Langganan tidak diperpanjang otomatis. Pilih paket dan periode, lalu ajukan; harga dihitung ulang dari jumlah
          pengguna internal saat ini. Paket dan periode baru berlaku setelah pembayaran dikonfirmasi.
          {renewal ? " Pengajuan baru menggantikan pengajuan yang sedang menunggu." : ""}
        </p>
        <RenewalForm
          plans={billing.plans}
          planCode={renewal?.planCode ?? subscription.planCode}
          period={renewal?.billingPeriod ?? subscription.billingPeriod}
          users={billing.internalUsers}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Modul</h2>
        <ModuleList modules={modules} />
      </section>
    </div>
  );
}
