import { useState } from "react";
import { toast } from "sonner";
import { createPayrollRun, getProfile, listPayrollRuns, listProfilesByRole } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PayrollPage() {
  const [, forceRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const runs = listPayrollRuns();
  const coaches = listProfilesByRole("coach").filter((c) => c.isActive);
  const session = getSession();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!session) return;
    const formData = new FormData(event.currentTarget);
    const result = createPayrollRun({
      coachId: String(formData.get("coachId")),
      periodStart: String(formData.get("periodStart")),
      periodEnd: String(formData.get("periodEnd")),
      baseSalary: Number(formData.get("baseSalary")),
      bonus: Number(formData.get("bonus") || 0),
      thr: Number(formData.get("thr") || 0),
      createdBy: session.userId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Gaji berhasil dibuat");
    event.currentTarget.reset();
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Gaji Pelatih</h1>

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
          {runs.map((r) => {
            const coach = getProfile(r.coachId);
            return (
              <TableRow key={r.id}>
                <TableCell>{coach?.fullName ?? "-"}</TableCell>
                <TableCell>
                  {r.periodStart} – {r.periodEnd}
                </TableCell>
                <TableCell>{formatRupiah(r.baseSalary)}</TableCell>
                <TableCell>{formatRupiah(r.bonus)}</TableCell>
                <TableCell>{formatRupiah(r.thr)}</TableCell>
                <TableCell>{formatRupiah(r.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "posted" ? "success" : "secondary"}>
                    {r.status === "posted" ? "Terposting" : "Draf"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {runs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Belum ada data gaji.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Buat Gaji Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coachId">Pelatih</Label>
              <Select id="coachId" name="coachId" required defaultValue="">
                <option value="" disabled>
                  Pilih pelatih
                </option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodStart">Awal Periode</Label>
                <Input id="periodStart" name="periodStart" type="date" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodEnd">Akhir Periode</Label>
                <Input id="periodEnd" name="periodEnd" type="date" required />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="baseSalary">Gaji Pokok (Rp)</Label>
                <Input id="baseSalary" name="baseSalary" type="number" min={0} step={1000} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bonus">Bonus (Rp)</Label>
                <Input id="bonus" name="bonus" type="number" min={0} step={1000} defaultValue={0} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="thr">THR (Rp)</Label>
                <Input id="thr" name="thr" type="number" min={0} step={1000} defaultValue={0} />
              </div>
            </div>
            <Button type="submit" className="w-fit">
              Buat Gaji
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
