import { getReports } from "@/lib/db";
import { formatMonth, formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const report = getReports();
  const cashFlowData = report.cashFlow.map((c) => ({ ...c, month: formatMonth(c.month) }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Laporan</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Pendapatan" value={formatRupiah(report.totalRevenue)} />
        <StatCard
          title="Tagihan Belum Bayar"
          value={`${report.outstandingCount} (${formatRupiah(report.outstandingAmount)})`}
        />
        <StatCard title="Total Biaya Gaji" value={formatRupiah(report.totalPayrollCost)} />
        <StatCard
          title="Anggota Aktif / Nonaktif"
          value={`${report.activeChildren} / ${report.inactiveChildren}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arus Kas Bulanan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="cashIn" stroke="var(--color-success)" name="Masuk" strokeWidth={2} />
                <Line type="monotone" dataKey="cashOut" stroke="var(--color-destructive)" name="Keluar" strokeWidth={2} />
                <Line type="monotone" dataKey="net" stroke="var(--color-primary)" name="Bersih" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pendapatan per Program</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.revenueByProgram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="packageName" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="revenue" fill="var(--color-primary)" name="Pendapatan" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
