import { useState } from "react";
import { toast } from "sonner";
import { createPackage, listPackages } from "@/lib/db";
import { formatRupiah } from "@/lib/format";
import type { BillingCycle } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Bulanan",
  quarterly: "Triwulan",
  yearly: "Tahunan",
};

export default function PackagesPage() {
  const [, forceRefresh] = useState(0);
  const packages = listPackages();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createPackage({
      name: String(formData.get("name")),
      price: Number(formData.get("price")),
      billingCycle: String(formData.get("billingCycle")) as BillingCycle,
      description: String(formData.get("description") || "") || undefined,
    });
    toast.success("Paket berhasil ditambahkan");
    event.currentTarget.reset();
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Paket Keanggotaan</h1>
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
          {packages.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell>{formatRupiah(p.price)}</TableCell>
              <TableCell>{CYCLE_LABEL[p.billingCycle]}</TableCell>
            </TableRow>
          ))}
          {packages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Belum ada paket.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Tambah Paket Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nama Paket</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Harga (Rp)</Label>
                <Input id="price" name="price" type="number" min={0} step={1000} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="billingCycle">Siklus Tagihan</Label>
                <Select id="billingCycle" name="billingCycle" defaultValue="monthly">
                  {Object.entries(CYCLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Deskripsi</Label>
              <Input id="description" name="description" />
            </div>
            <Button type="submit" className="w-fit">
              Tambah Paket
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
