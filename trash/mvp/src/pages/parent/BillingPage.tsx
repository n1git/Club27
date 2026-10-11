import { getSession } from "@/lib/auth";
import { getChild, listChildrenByParent, listInvoicesByChild } from "@/lib/db";
import { formatRupiah } from "@/lib/format";
import type { InvoiceStatus } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<InvoiceStatus, "success" | "secondary" | "destructive"> = {
  paid: "success",
  outstanding: "secondary",
  void: "destructive",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Lunas",
  outstanding: "Belum Bayar",
  void: "Dibatalkan",
};

export default function ParentBillingPage() {
  const session = getSession();
  const children = session ? listChildrenByParent(session.userId) : [];
  const invoices = children.flatMap((c) => listInvoicesByChild(c.id));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Tagihan</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Anak</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Jatuh Tempo</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const child = getChild(inv.childId);
            return (
              <TableRow key={inv.id}>
                <TableCell>{child?.fullName ?? "-"}</TableCell>
                <TableCell>
                  {inv.periodStart} – {inv.periodEnd}
                </TableCell>
                <TableCell>{inv.dueDate}</TableCell>
                <TableCell>{formatRupiah(inv.amount)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada tagihan.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
