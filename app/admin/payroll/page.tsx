import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCoaches } from "@/lib/data/lookups";
import { buttonVariants } from "@/components/ui/button";
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
import { PayrollRunForm } from "@/components/payroll/payroll-run-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function PayrollPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: runs }, coaches] = await Promise.all([
    supabase
      .from("payroll_runs")
      .select("id, period_start, period_end, base_salary, bonus, thr, total_amount, status, profiles:club_profiles(full_name)")
      .order("period_start", { ascending: false }),
    getActiveCoaches(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Gaji Pelatih</>} />
        <TriggerDialog trigger={<span className={buttonVariants({})}>Buat Gaji Baru</span>}>
          <h2 className="mb-4 text-xl font-semibold">Buat Gaji Baru</h2>
          <PayrollRunForm coaches={coaches} />
        </TriggerDialog>
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground">Riwayat Gaji</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pelatih</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Gaji Pokok</TableHead>
            <TableHead>Bonus</TableHead>
            <TableHead>THR</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(runs ?? []).map((r) => {
            const row = r as unknown as {
              id: string;
              period_start: string;
              period_end: string;
              base_salary: number;
              bonus: number;
              thr: number;
              total_amount: number;
              status: string;
              profiles: { full_name: string } | null;
            };
            return (
              <TableRow key={row.id}>
                <TableCell>{row.profiles?.full_name ?? "-"}</TableCell>
                <TableCell>
                  {row.period_start} – {row.period_end}
                </TableCell>
                <TableCell>Rp {Number(row.base_salary).toLocaleString("id-ID")}</TableCell>
                <TableCell>Rp {Number(row.bonus).toLocaleString("id-ID")}</TableCell>
                <TableCell>Rp {Number(row.thr).toLocaleString("id-ID")}</TableCell>
                <TableCell>Rp {Number(row.total_amount).toLocaleString("id-ID")}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "posted" ? "success" : "secondary"}>
                    {row.status === "posted" ? "Terposting" : "Draf"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {(runs ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Belum ada data gaji.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
