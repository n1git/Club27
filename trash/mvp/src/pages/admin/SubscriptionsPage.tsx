import { useState } from "react";
import { toast } from "sonner";
import {
  cancelSubscription,
  createSubscription,
  getChild,
  listChildren,
  listPackages,
  listSubscriptions,
} from "@/lib/db";
import type { SubscriptionStatus } from "@/types/db";
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

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Aktif",
  paused: "Ditunda",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export default function SubscriptionsPage() {
  const [, forceRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const subscriptions = listSubscriptions();
  const children = listChildren().filter((c) => c.isActive);
  const packages = listPackages().filter((p) => p.isActive);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = createSubscription(
      String(formData.get("childId")),
      String(formData.get("packageId")),
      String(formData.get("startDate"))
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Langganan berhasil ditambahkan");
    event.currentTarget.reset();
    forceRefresh((n) => n + 1);
  }

  function handleCancel(subscriptionId: string) {
    if (!window.confirm("Batalkan langganan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    cancelSubscription(subscriptionId);
    toast.success("Langganan dibatalkan");
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Langganan</h1>
      <h2 className="text-sm font-semibold text-muted-foreground">Daftar Langganan</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Anak</TableHead>
            <TableHead>Paket</TableHead>
            <TableHead>Mulai</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((s) => {
            const child = getChild(s.childId);
            const pkg = packages.find((p) => p.id === s.packageId) ?? listPackages().find((p) => p.id === s.packageId);
            return (
              <TableRow key={s.id}>
                <TableCell>{child?.fullName ?? "-"}</TableCell>
                <TableCell>{pkg?.name ?? "-"}</TableCell>
                <TableCell>{s.startDate}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "active" ? "success" : "secondary"}>
                    {STATUS_LABEL[s.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {s.status === "active" ? (
                    <Button variant="ghost" size="sm" onClick={() => handleCancel(s.id)}>
                      Batalkan Langganan
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
          {subscriptions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada langganan.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Tambah Langganan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="childId">Anak</Label>
              <Select id="childId" name="childId" required defaultValue="">
                <option value="" disabled>
                  Pilih anak
                </option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="packageId">Paket</Label>
              <Select id="packageId" name="packageId" required defaultValue="">
                <option value="" disabled>
                  Pilih paket
                </option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <Button type="submit" className="w-fit">
              Tambah Langganan
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
