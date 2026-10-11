import { useState } from "react";
import { toast } from "sonner";
import { createClassType, createLocation, listClassTypes, listLocations } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [, forceRefresh] = useState(0);
  const locations = listLocations();
  const classTypes = listClassTypes();

  function handleLocationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    createLocation(name, String(formData.get("address") ?? "") || undefined);
    toast.success("Lokasi berhasil ditambahkan");
    event.currentTarget.reset();
    forceRefresh((n) => n + 1);
  }

  function handleClassTypeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    createClassType(name, String(formData.get("description") ?? "") || undefined);
    toast.success("Jenis kelas berhasil ditambahkan");
    event.currentTarget.reset();
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pengaturan</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lokasi Kolam</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <Badge key={l.id} variant="secondary">
                  {l.name}
                </Badge>
              ))}
              {locations.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada lokasi.</p> : null}
            </div>
            <form onSubmit={handleLocationSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location-name">Nama Lokasi</Label>
                <Input id="location-name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location-address">Alamat</Label>
                <Input id="location-address" name="address" />
              </div>
              <Button type="submit" className="w-fit">
                Tambah Lokasi
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jenis Kelas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {classTypes.map((c) => (
                <Badge key={c.id} variant="secondary">
                  {c.name}
                </Badge>
              ))}
              {classTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada jenis kelas.</p>
              ) : null}
            </div>
            <form onSubmit={handleClassTypeSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="class-type-name">Nama Jenis Kelas</Label>
                <Input id="class-type-name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="class-type-description">Deskripsi</Label>
                <Input id="class-type-description" name="description" />
              </div>
              <Button type="submit" className="w-fit">
                Tambah Jenis Kelas
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
