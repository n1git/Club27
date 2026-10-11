import { useState } from "react";
import { toast } from "sonner";
import { addManualAdjustment, listLedgerWithBalance } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { LedgerCategory } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  payment_received: "Pembayaran Diterima",
  payroll: "Gaji Pelatih",
  manual_adjustment: "Penyesuaian Manual",
};

export default function CashLedgerPage() {
  const [, forceRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const entries = [...listLedgerWithBalance()].reverse();
  const session = getSession();
  const latestBalance = entries[0]?.runningBalance ?? 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!session) return;
    const formData = new FormData(event.currentTarget);
    const result = addManualAdjustment(
      formData.get("direction") === "in" ? "in" : "out",
      Number(formData.get("amount")),
      String(formData.get("reason")),
      session.userId
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Penyesuaian berhasil ditambahkan");
    event.currentTarget.reset();
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Buku Kas</h1>
        <Badge variant={latestBalance >= 0 ? "success" : "destructive"} className="text-sm">
          Saldo: {formatRupiah(latestBalance)}
        </Badge>
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground">Riwayat Transaksi</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Arah</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Keterangan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{formatDateTime(e.entryDate)}</TableCell>
              <TableCell>{CATEGORY_LABEL[e.category]}</TableCell>
              <TableCell>
                <Badge variant={e.direction === "in" ? "success" : "secondary"}>
                  {e.direction === "in" ? "Masuk" : "Keluar"}
                </Badge>
              </TableCell>
              <TableCell>{formatRupiah(e.amount)}</TableCell>
              <TableCell>{formatRupiah(e.runningBalance)}</TableCell>
              <TableCell>{e.reason ?? "-"}</TableCell>
            </TableRow>
          ))}
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Belum ada transaksi.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Tambah Penyesuaian Manual</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="direction">Jenis</Label>
                <Select id="direction" name="direction" defaultValue="out">
                  <option value="in">Uang Masuk</option>
                  <option value="out">Uang Keluar</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Jumlah (Rp)</Label>
                <Input id="amount" name="amount" type="number" min={1} step={1000} required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Alasan</Label>
              <Textarea id="reason" name="reason" required minLength={3} />
            </div>
            <Button type="submit" className="w-fit">
              Tambah Penyesuaian
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
