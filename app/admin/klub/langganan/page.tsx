import { requirePermission } from "@/lib/auth/guard";
import { organizationIdForTenant } from "@/lib/data/roles";
import { getModules, getOrganizationBilling, listInternalUsers } from "@/lib/data/platform-pricing";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import { STATUS_LABEL } from "@/lib/validations/superadmin";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { RenewalForm } from "@/components/subscription/renewal-form";
import { SeatPurchaseForm } from "@/components/subscription/seat-purchase-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPendingRenewal } from "@/lib/billing/renewals";
import { isLockedPhase } from "@/lib/billing/access";
import { getContact } from "@/lib/site";
import { isMidtransConfigured } from "@/lib/payments/midtrans";
import { RetryPaymentForm } from "@/components/subscription/retry-payment-form";
import { buttonVariants } from "@/components/ui/button";
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

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ bayar?: string }> }) {
  const user = await requirePermission("billing.view");
  const organizationId = await organizationIdForTenant(user.tenantId);
  if (!organizationId) return <p className="text-sm text-muted-foreground">Langganan belum tersedia.</p>;
  const canManage = user.permissions.has("billing.manage");
  const { bayar } = await searchParams;
  const gateway = isMidtransConfigured();
  const [billing, users, modules, renewal] = await Promise.all([
    getOrganizationBilling(organizationId),
    listInternalUsers(organizationId),
    getModules(),
    getPendingRenewal(organizationId),
  ]);
  if (!billing) return <p className="text-sm text-muted-foreground">Langganan belum tersedia.</p>;

  const { subscription, plan, quote } = billing;
  const periodUnit = subscription.billingPeriod === "yearly" ? "tahun" : "bulan";
  const locked = isLockedPhase(billing.phase);
  const graceNow = billing.phase === "grace";
  const pendingSeats = subscription.pendingSeats;
  const billedSeats = pendingSeats ?? subscription.seats;
  const contact = getContact();
  const longDate = { day: "numeric", month: "long", year: "numeric" } as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <PageHeader title={<>Langganan</>} />
        <Badge variant={STATUS_VARIANT[subscription.status]}>{STATUS_LABEL[subscription.status]}</Badge>
      </div>

      {graceNow ? (
        <Alert variant="warning">
          <AlertTitle>Langganan berakhir, data hanya bisa dibaca</AlertTitle>
          <AlertDescription>
            Semua pengguna masih bisa melihat data, tetapi perubahan ditolak sampai langganan diperpanjang.
            {billing.graceEndsOn ? ` Data disimpan sampai ${formatJakartaDate(billing.graceEndsOn, longDate)}.` : ""}
          </AlertDescription>
        </Alert>
      ) : locked ? (
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

      {bayar === "selesai" && renewal ? (
        <Alert>
          <AlertTitle>Pembayaran sedang diproses</AlertTitle>
          <AlertDescription>Status langganan diperbarui otomatis setelah pembayaran terkonfirmasi. Muat ulang halaman ini beberapa saat lagi.</AlertDescription>
        </Alert>
      ) : null}

      {renewal ? (
        <Alert>
          <AlertTitle>Menunggu pembayaran</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span>
              {renewal.kind === "seats"
                ? `Tambah ${renewal.seatsAdded} seat (jadi ${renewal.users})`
                : `${renewal.planName ?? renewal.planCode} · ${PERIOD_LABEL[renewal.billingPeriod]} · ${renewal.users} seat`}{" "}
              · <strong>{formatRupiah(renewal.amount)}</strong>, diajukan {formatJakartaDate(renewal.requestedAt, longDate)}.
            </span>
            {gateway ? (
              <>
                <span>
                  Bayar lewat transfer bank, e-wallet, atau QRIS. Langganan aktif otomatis setelah pembayaran berhasil.
                </span>
                {renewal.paymentUrl ? (
                  <a href={renewal.paymentUrl} className={buttonVariants({ size: "sm", className: "mt-2 w-fit" })}>
                    Bayar sekarang
                  </a>
                ) : (
                  <RetryPaymentForm />
                )}
              </>
            ) : (
              <span>
                Lakukan pembayaran lalu kirim bukti ke admin platform
                {contact.email ? ` (${contact.email})` : ""}
                {contact.whatsapp ? `${contact.email ? " atau" : ""} WhatsApp +${contact.whatsapp}` : ""}. Periode baru
                dimulai setelah periode berjalan habis, atau hari konfirmasi bila sudah lewat.
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Paket" value={`${plan.name} · ${PERIOD_LABEL[subscription.billingPeriod]}`} />
        <MetricCard title="Seat terpakai" value={`${billing.seatsUsed} / ${subscription.seats}`} />
        <MetricCard
          title="Klub"
          value={billing.clubLimit !== null ? `${billing.clubs} / ${billing.clubLimit}` : `${billing.clubs} (tak terbatas)`}
        />
        <MetricCard title={`Total per ${periodUnit}`} value={formatRupiah(quote.total)} />
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        {quote.users} seat × {formatRupiah(quote.unitPrice)} × {quote.months.toLocaleString("id-ID")} bulan ={" "}
        {formatRupiah(quote.total)}
        {subscription.billingPeriod === "yearly" ? `, setara ${formatRupiah(quote.perMonth)}/bulan` : ""}.
        {subscription.currentPeriodEnd
          ? ` Periode berjalan sampai ${formatJakartaDate(subscription.currentPeriodEnd, longDate)}.`
          : ""}
        {subscription.status === "trial" && subscription.trialEndsAt
          ? ` Trial sampai ${formatJakartaDate(subscription.trialEndsAt, longDate)}.`
          : ""}
        {pendingSeats !== null && subscription.pendingSeatsFrom
          ? ` Seat turun menjadi ${pendingSeats} mulai ${formatJakartaDate(subscription.pendingSeatsFrom, longDate)}.`
          : ""}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pengguna berseat</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Klub</TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Satu orang memakai satu seat di organisasi ini, berapa pun jumlah klubnya. Anggota, pelatih, dan peran gratis tidak memakai seat.
        </p>
      </section>

      {canManage ? (
        <>
          {billing.phase === "active" ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Tambah seat</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Seat tambahan berlaku sampai periode berjalan berakhir dan ditagih prorata sesuai sisa hari. Mengurangi seat dilakukan
                saat perpanjangan: jumlah baru berlaku di periode berikutnya.
              </p>
              <SeatPurchaseForm seats={subscription.seats} />
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Perpanjang atau ganti paket</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Langganan tidak diperpanjang otomatis. Pilih paket, periode, dan jumlah seat, lalu ajukan; harga dihitung ulang di server.
              Paket dan periode baru berlaku setelah pembayaran dikonfirmasi.
              {renewal ? " Pengajuan baru menggantikan pengajuan yang sedang menunggu." : ""}
            </p>
            <RenewalForm
              plans={billing.plans}
              planCode={renewal?.kind === "renewal" ? renewal.planCode : subscription.planCode}
              period={renewal?.kind === "renewal" ? renewal.billingPeriod : subscription.billingPeriod}
              seats={Math.max(renewal?.kind === "renewal" ? renewal.users : billedSeats, billing.seatsUsed, 1)}
              minSeats={billing.seatsUsed}
              maxSeats={billing.phase === "active" ? subscription.seats : null}
            />
          </section>
        </>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Modul</h2>
        <ModuleList modules={modules} />
      </section>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
