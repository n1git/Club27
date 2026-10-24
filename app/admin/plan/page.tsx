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
import Link from "next/link";
import { getBillingProfile, getPendingRenewal, listRenewals, RENEWAL_STATUS_LABEL } from "@/lib/billing/renewals";
import { BillingProfileForm } from "@/components/subscription/billing-profile-form";
import { isLockedPhase } from "@/lib/billing/access";
import { getContact } from "@/lib/site";
import { isMidtransConfigured } from "@/lib/payments/midtrans";
import { RetryPaymentForm } from "@/components/subscription/retry-payment-form";
import { buttonVariants } from "@/components/ui/button";
import { ModuleList } from "@/components/pricing/pricing-picker";
import { Card, CardContent } from "@/components/ui/card";
import { TriggerDialog } from "@/components/ui/dialog";
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
  const [billing, users, modules, renewal, history, profile] = await Promise.all([
    getOrganizationBilling(organizationId),
    listInternalUsers(organizationId),
    getModules(),
    getPendingRenewal(organizationId),
    listRenewals(organizationId),
    getBillingProfile(organizationId),
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

  const until = subscription.status === "trial" ? subscription.trialEndsAt : subscription.currentPeriodEnd;
  const untilLabel = subscription.status === "trial" ? "Trial sampai" : billing.phase === "active" ? "Aktif sampai" : "Berakhir";
  const payLabel = renewal ? `Bayar ${formatRupiah(renewal.amount)}` : "";
  const summary = (row: NonNullable<typeof renewal>) =>
    row.items[0]?.description ?? (row.kind === "seats" ? `Tambah ${row.seatsAdded} seat` : `${row.planName ?? row.planCode} · ${PERIOD_LABEL[row.billingPeriod]}`);

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
            Perpanjang untuk bisa mengubah data lagi.
            {billing.graceEndsOn ? ` Data disimpan sampai ${formatJakartaDate(billing.graceEndsOn, longDate)}.` : ""}
          </AlertDescription>
        </Alert>
      ) : locked ? (
        <Alert variant="warning">
          <AlertTitle>Akses klub dikunci</AlertTitle>
          <AlertDescription>Data tetap tersimpan. Perpanjang untuk membuka akses lagi.</AlertDescription>
        </Alert>
      ) : (
        <SubscriptionBanner />
      )}

      {bayar === "selesai" && renewal ? (
        <Alert>
          <AlertTitle>Pembayaran sedang diproses</AlertTitle>
          <AlertDescription>Halaman ini diperbarui otomatis setelah pembayaran terkonfirmasi.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <dl className="grid gap-x-10 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Paket</dt>
              <dd className="font-semibold">
                {plan.name} · {PERIOD_LABEL[subscription.billingPeriod]}
              </dd>
              {until ? (
                <dd className="text-sm text-muted-foreground">
                  {untilLabel} {formatJakartaDate(until, longDate)}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Seat</dt>
              <dd className="font-semibold">
                {billing.seatsUsed} dari {subscription.seats} terpakai
              </dd>
              {pendingSeats !== null && subscription.pendingSeatsFrom ? (
                <dd className="text-sm text-muted-foreground">
                  Jadi {pendingSeats} mulai {formatJakartaDate(subscription.pendingSeatsFrom, longDate)}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Biaya</dt>
              <dd className="font-semibold">
                {formatRupiah(quote.total)}/{periodUnit}
              </dd>
              <dd className="text-sm text-muted-foreground">{billing.clubLimit !== null ? `${billing.clubs} dari ${billing.clubLimit} klub` : `${billing.clubs} klub`}</dd>
            </div>
          </dl>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <TriggerDialog trigger={<span className={buttonVariants()}>Perpanjang</span>}>
                <h2 className="mb-1 text-lg font-semibold">Perpanjang langganan</h2>
                <p className="mb-4 text-sm text-muted-foreground">Berlaku setelah periode sekarang berakhir.</p>
                <RenewalForm
                  plans={billing.plans}
                  planCode={subscription.planCode}
                  period={subscription.billingPeriod}
                  seats={Math.max(billedSeats, billing.seatsUsed, 1)}
                  minSeats={billing.seatsUsed}
                  maxSeats={billing.phase === "active" ? subscription.seats : null}
                  gateway={gateway}
                />
              </TriggerDialog>
              {billing.phase === "active" ? (
                <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline" })}>Tambah seat</span>}>
                  <h2 className="mb-1 text-lg font-semibold">Tambah seat</h2>
                  <p className="mb-4 text-sm text-muted-foreground">Dibayar prorata sampai periode sekarang berakhir.</p>
                  <SeatPurchaseForm seats={subscription.seats} gateway={gateway} />
                </TriggerDialog>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {renewal ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Tagihan belum dibayar{renewal.invoiceNumber ? ` · ${renewal.invoiceNumber}` : ""}</span>
              <span className="font-semibold">{summary(renewal)}</span>
              <span className="text-lg font-bold">{formatRupiah(renewal.amount)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {renewal.invoiceNumber ? (
                <Link href={`/admin/plan/invoice/${renewal.id}`} className="text-sm text-accent-foreground underline underline-offset-4">
                  Lihat invoice
                </Link>
              ) : null}
              {canManage && gateway ? (
                renewal.paymentUrl ? (
                  <a href={renewal.paymentUrl} className={buttonVariants({ className: "w-full sm:w-fit" })}>
                    {payLabel}
                  </a>
                ) : (
                  <RetryPaymentForm label={payLabel} />
                )
              ) : null}
            </div>
          </CardContent>
          {!gateway ? (
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Transfer lalu kirim bukti ke admin platform
              {contact.email ? ` (${contact.email})` : ""}
              {contact.whatsapp ? `${contact.email ? " atau" : ""} WhatsApp +${contact.whatsapp}` : ""}.
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Riwayat tagihan</h2>
        {history.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor</TableHead>
                <TableHead className="hidden sm:table-cell">Tanggal</TableHead>
                <TableHead className="hidden md:table-cell">Keterangan</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dokumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{row.invoiceNumber ?? "-"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{formatJakartaDate(row.invoiceDate ?? row.requestedAt)}</TableCell>
                  <TableCell className="hidden md:table-cell">{summary(row)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatRupiah(row.amount)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={row.status === "paid" ? "success" : row.status === "pending" ? "warning" : "secondary"}>
                      {RENEWAL_STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-3 whitespace-nowrap">
                    {row.invoiceNumber ? (
                      <Link href={`/admin/plan/invoice/${row.id}`} className="text-accent-foreground underline underline-offset-4">
                        Invoice
                      </Link>
                    ) : null}
                    {row.receiptNumber ? (
                      <Link href={`/admin/plan/receipt/${row.id}`} className="text-accent-foreground underline underline-offset-4">
                        Kwitansi
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada tagihan.</p>
        )}
      </section>

      <div className="flex flex-col divide-y rounded-lg border">
        <details className="group px-4 py-3">
          <summary className="cursor-pointer font-medium">Pengguna berseat ({users.length})</summary>
          <div className="mt-3 flex flex-col gap-2">
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
            <p className="text-xs text-muted-foreground">Pelatih, kasir, dan anggota tidak memakai seat.</p>
          </div>
        </details>
        {canManage ? (
          <details className="px-4 py-3">
            <summary className="cursor-pointer font-medium">Data penagihan</summary>
            <div className="mt-3">
              <BillingProfileForm address={profile.address} email={profile.email} />
            </div>
          </details>
        ) : null}
        <details className="px-4 py-3">
          <summary className="cursor-pointer font-medium">Modul termasuk</summary>
          <div className="mt-3">
            <ModuleList modules={modules} />
          </div>
        </details>
      </div>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
