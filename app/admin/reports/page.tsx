import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MetricCard } from "@/components/ui/metric-card";
import { CashflowChart } from "@/components/reports/cashflow-chart";
import { RevenueByProgramChart } from "@/components/reports/revenue-chart";
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

function formatRupiah(value: number) {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function formatMonth(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient();

  const [
    { data: revenue },
    { data: outstanding },
    { data: cashFlow },
    { data: revenueByProgram },
    { data: payrollCost },
    { data: memberCounts },
  ] = await Promise.all([
    supabase.from("report_revenue").select("month, revenue"),
    supabase.from("report_outstanding").select("outstanding_count, outstanding_amount").maybeSingle(),
    supabase.from("report_cash_flow").select("month, cash_in, cash_out, net"),
    supabase.from("report_revenue_by_program").select("package_name, revenue"),
    supabase.from("report_payroll_cost").select("month, payroll_cost"),
    supabase.from("report_member_counts").select("active_members, inactive_members").maybeSingle(),
  ]);

  const totalRevenue = (revenue ?? []).reduce((sum, r) => sum + Number(r.revenue), 0);
  const totalPayrollCost = (payrollCost ?? []).reduce((sum, r) => sum + Number(r.payroll_cost), 0);

  const cashFlowData = (cashFlow ?? []).map((c) => ({
    month: formatMonth(c.month),
    cash_in: Number(c.cash_in),
    cash_out: Number(c.cash_out),
    net: Number(c.net),
  }));

  const revenueByProgramData = (revenueByProgram ?? []).map((r) => ({
    package_name: r.package_name,
    revenue: Number(r.revenue),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Laporan</>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Pendapatan" value={formatRupiah(totalRevenue)} />
        <MetricCard
          title="Tagihan Belum Bayar"
          value={`${outstanding?.outstanding_count ?? 0} (${formatRupiah(outstanding?.outstanding_amount ?? 0)})`}
        />
        <MetricCard title="Total Biaya Gaji" value={formatRupiah(totalPayrollCost)} />
        <MetricCard
          title="Anggota Aktif / Nonaktif"
          value={`${memberCounts?.active_members ?? 0} / ${memberCounts?.inactive_members ?? 0}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arus Kas Bulanan</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowChart data={cashFlowData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pendapatan per Program</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueByProgramChart data={revenueByProgramData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Biaya Gaji per Bulan</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bulan</TableHead>
                <TableHead>Biaya Gaji</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payrollCost ?? []).map((p) => (
                <TableRow key={p.month}>
                  <TableCell>{formatMonth(p.month)}</TableCell>
                  <TableCell>{formatRupiah(p.payroll_cost)}</TableCell>
                </TableRow>
              ))}
              {(payrollCost ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Belum ada data gaji.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
