import Link from "next/link";
import { getDashboardData } from "@/lib/data/dashboard";
import { getBookingKpis } from "@/lib/data/booking";
import { getSalesToday } from "@/lib/data/commerce";
import { formatJakartaDate, formatJakartaTime } from "@/lib/format";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { getEnabledModules } from "@/lib/modules";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

function formatRupiah(value: number) {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function formatTime(value: string) {
  return formatJakartaTime(value, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  return formatJakartaDate(value);
}

const CASH_CATEGORY_LABEL: Record<string, string> = {
  payment_received: "Pembayaran Diterima",
  payroll: "Gaji Pelatih",
  manual_adjustment: "Penyesuaian Manual",
  order_payment: "Penjualan Kasir",
  order_reversal: "Pembatalan Kasir",
};

const QUICK_LINKS = [
  { href: "/admin/members/new", label: "Tambah Anggota" },
  { href: "/admin/schedule/new", label: "Tambah Kelas", module: "classes" },
  {
    href: "/admin/billing/invoices",
    label: "Kelola Tagihan",
    module: "billing",
  },
  { href: "/admin/promo", label: "Kelola Promo", module: "promo" },
];

export default async function AdminDashboardPage() {
  const [data, enabled] = await Promise.all([
    getDashboardData(),
    getEnabledModules(),
  ]);
  const [booking, sales] = await Promise.all([
    enabled.has("resource_booking") ? getBookingKpis() : null,
    enabled.has("pos") ? getSalesToday() : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <RefreshOnFocus />
      <PageHeader title={<>Dasbor Admin</>} />

      <SubscriptionBanner />
      <OnboardingBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Pendapatan"
          value={formatRupiah(data.totalRevenue)}
          spark={data.revenueSpark}
          delta={data.revenueDelta ?? undefined}
          deltaLabel="vs 7 hari lalu"
        />
        <MetricCard
          title="Tagihan Belum Bayar"
          value={`${data.outstandingCount} (${formatRupiah(data.outstandingAmount)})`}
        />
        <MetricCard
          title="Saldo Kas"
          value={formatRupiah(data.cashBalance)}
          spark={data.balanceSpark}
          delta={data.balanceDelta ?? undefined}
          deltaLabel="vs 14 hari lalu"
        />
        <MetricCard
          title="Anggota Aktif / Nonaktif"
          value={`${data.activeMembers} / ${data.inactiveMembers}`}
        />
        {booking ? (
          <MetricCard
            title="Booking Hari Ini"
            value={String(booking.bookingsToday)}
          />
        ) : null}
        {booking ? (
          <MetricCard
            title="Okupansi Fasilitas Minggu Ini"
            value={
              booking.utilizationWeek === null
                ? "Belum ada jam buka"
                : `${booking.utilizationWeek.toLocaleString("id-ID")}%`
            }
          />
        ) : null}
        {sales ? (
          <MetricCard
            title="Penjualan Hari Ini"
            value={`${formatRupiah(sales.total)} (${sales.count} pesanan)`}
          />
        ) : null}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kelas Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Pelatih</TableHead>
                  <TableHead>Peserta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.todaysClasses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {formatTime(c.startTime)} – {formatTime(c.endTime)}
                    </TableCell>
                    <TableCell>
                      {c.classTypeName} · {c.locationName}
                    </TableCell>
                    <TableCell>{c.coachName}</TableCell>
                    <TableCell>
                      {c.bookedCount} / {c.capacity}
                    </TableCell>
                  </TableRow>
                ))}
                {data.todaysClasses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Tidak ada kelas hari ini.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transaksi Kas Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentCashEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.entryDate)}</TableCell>
                    <TableCell>
                      {CASH_CATEGORY_LABEL[e.category] ?? e.category}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={e.direction === "in" ? "success" : "secondary"}
                      >
                        {e.direction === "in" ? "+" : "-"}
                        {formatRupiah(e.amount)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {data.recentCashEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      Belum ada transaksi.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tagihan Terlambat</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anggota</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.overdueInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.memberName}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      {formatDate(inv.dueDate)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatRupiah(inv.amount)}</TableCell>
                </TableRow>
              ))}
              {data.overdueInvoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    Tidak ada tagihan terlambat.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Langganan Akan Berakhir (7 Hari)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anggota</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Berakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expiringSubscriptions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.memberName}</TableCell>
                  <TableCell>{s.packageName}</TableCell>
                  <TableCell>
                    <Badge variant="warning">{formatDate(s.endDate)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.expiringSubscriptions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    Tidak ada langganan yang akan berakhir.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {QUICK_LINKS.filter(
            (link) => !link.module || enabled.has(link.module),
          ).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={buttonVariants({ variant: "outline" })}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin/reports"
            className={buttonVariants({ variant: "ghost" })}
          >
            Lihat Laporan Lengkap ({data.activePromoCount} promo aktif)
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
