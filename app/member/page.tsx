import { buttonVariants } from "@/components/ui/button";
import { requireMemberClub } from "@/lib/auth/guard";
import { getMemberOverview } from "@/lib/data/member-portal";
import {
  formatJakartaDate,
  formatJakartaDateTime,
  formatJakartaTime,
} from "@/lib/format";
import { formatRupiah } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: "Aktif",
  paused: "Dijeda",
  cancelled: "Dibatalkan",
  expired: "Berakhir",
};

const INVOICE_STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" }
> = {
  outstanding: { label: "Belum dibayar", variant: "warning" },
  paid: { label: "Lunas", variant: "success" },
  void: { label: "Dibatalkan", variant: "secondary" },
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "per bulan",
  quarterly: "per 3 bulan",
  yearly: "per tahun",
};

function date(value: string) {
  return formatJakartaDate(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function MemberHomePage() {
  await requireMemberClub();
  const overview = await getMemberOverview();
  if (!overview)
    return (
      <p className="text-sm text-muted-foreground">
        Data keanggotaan tidak ditemukan.
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Halo, {overview.fullName}</>} />

      {overview.subscriptions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Langganan</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Belum ada langganan.
          </CardContent>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Langganan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {overview.subscriptions.map((sub) => (
              <Card key={sub.id}>
                <CardHeader className="gap-2">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {sub.packageName}
                    <Badge
                      variant={
                        sub.status === "active" ? "success" : "secondary"
                      }
                    >
                      {SUBSCRIPTION_STATUS[sub.status] ?? sub.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <p className="text-muted-foreground">
                    Mulai {date(sub.startDate)}
                    {sub.endDate ? ` · sampai ${date(sub.endDate)}` : ""}
                  </p>
                  {sub.pricingMode === "session_pack" &&
                  sub.sessionsRemaining !== null ? (
                    <p className="font-medium">
                      Sisa {sub.sessionsRemaining} dari {sub.sessionsIncluded}{" "}
                      sesi ({sub.sessionsUsed} terpakai)
                    </p>
                  ) : (
                    <p>
                      {sub.billingCycle
                        ? `Tagihan ${CYCLE_LABEL[sub.billingCycle] ?? sub.billingCycle}`
                        : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tagihan</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead>Jatuh tempo</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.invoices.map((invoice) => {
                const status = INVOICE_STATUS[invoice.status] ?? {
                  label: invoice.status,
                  variant: "secondary" as const,
                };
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {date(invoice.periodStart)} – {date(invoice.periodEnd)}
                    </TableCell>
                    <TableCell>{date(invoice.dueDate)}</TableCell>
                    <TableCell>{formatRupiah(invoice.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {invoice.paidAt ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {date(invoice.paidAt)}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
              {overview.invoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    Belum ada tagihan.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kelas mendatang</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Jenis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell>
                    {formatJakartaDateTime(cls.startTime)} —{" "}
                    {formatJakartaTime(cls.endTime)}
                  </TableCell>
                  <TableCell>{cls.locationName}</TableCell>
                  <TableCell>{cls.classTypeName}</TableCell>
                </TableRow>
              ))}
              {overview.classes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    Belum ada kelas terjadwal.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {overview.promos.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Promo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {overview.promos.map((promo) => (
              <Card key={promo.id}>
                <CardHeader>
                  <CardTitle>{promo.title}</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
                  {promo.body}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Data Anda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Unduh salinan data Anda di klub ini dalam format JSON.
          </p>
          <a
            href="/api/member/export"
            download
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 w-fit",
            })}
          >
            Unduh data saya
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
