import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { TriggerDialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageForm } from "@/components/billing/package-form";
import { PageHeader } from "@/components/ui/page-header";

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Bulanan",
  quarterly: "Triwulan",
  yearly: "Tahunan",
};

export default async function PackagesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: packages } = await supabase
    .from("membership_packages")
    .select("id, name, price, billing_period, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Paket Keanggotaan</>} />
        <TriggerDialog trigger={<span className={buttonVariants({})}>Tambah Paket</span>}>
          <h2 className="mb-4 text-xl font-semibold">Tambah Paket Baru</h2>
          <PackageForm />
        </TriggerDialog>
      </div>
      <h2 className="text-sm font-semibold text-muted-foreground">Daftar Paket</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Harga</TableHead>
            <TableHead>Siklus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(packages ?? []).map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell>Rp {Number(p.price).toLocaleString("id-ID")}</TableCell>
              <TableCell>{CYCLE_LABEL[p.billing_period] ?? p.billing_period}</TableCell>
            </TableRow>
          ))}
          {(packages ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Belum ada paket.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
