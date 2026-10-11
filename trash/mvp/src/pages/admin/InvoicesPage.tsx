import { useState } from "react";
import { toast } from "sonner";
import { generateInvoices, getChild, listInvoices, markInvoicePaid, voidInvoice } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import type { InvoiceStatus } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function InvoicesPage() {
  const [, forceRefresh] = useState(0);
  const invoices = listInvoices();
  const session = getSession();

  const today = new Date();
  const defaultPeriodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultPeriodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const count = generateInvoices(
      String(formData.get("periodStart")),
      String(formData.get("periodEnd")),
      String(formData.get("dueDate"))
    );
    toast.success(`${count} tagihan baru dibuat`);
    forceRefresh((n) => n + 1);
  }

  function handleMarkPaid(invoiceId: string) {
    if (!session) return;
    const result = markInvoicePaid(invoiceId, session.userId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tagihan ditandai lunas");
    forceRefresh((n) => n + 1);
  }

  function handleVoid(invoiceId: string) {
    if (!window.confirm("Batalkan tagihan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    voidInvoice(invoiceId);
    toast.success("Tagihan dibatalkan");
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tagihan</h1>
      <h2 className="text-sm font-semibold text-muted-foreground">Daftar Tagihan</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Anak</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Jatuh Tempo</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
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
                <TableCell>
                  {inv.status === "outstanding" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleMarkPaid(inv.id)}>
                        Tandai Lunas
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleVoid(inv.id)}>
                        Batalkan Tagihan
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Belum ada tagihan.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Buat Tagihan Periode Berjalan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodStart">Awal Periode</Label>
                <Input id="periodStart" name="periodStart" type="date" defaultValue={defaultPeriodStart} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodEnd">Akhir Periode</Label>
                <Input id="periodEnd" name="periodEnd" type="date" defaultValue={defaultPeriodEnd} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dueDate">Jatuh Tempo</Label>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultPeriodEnd} required />
              </div>
            </div>
            <Button type="submit" className="w-fit">
              Buat Tagihan Bulan Ini
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
