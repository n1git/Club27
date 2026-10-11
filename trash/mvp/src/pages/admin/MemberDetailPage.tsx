import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getChild, getProfile, listLocations, updateChild } from "@/lib/db";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, forceRefresh] = useState(0);
  const child = id ? getChild(id) : undefined;
  const locations = listLocations();

  if (!id || !child) return <Navigate to="/admin/members" replace />;

  const parent = getProfile(child.parentId);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateChild(child!.id, {
      fullName: String(formData.get("childFullName")),
      dateOfBirth: String(formData.get("dateOfBirth")),
      address: String(formData.get("address") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
      preferredLocationId: String(formData.get("preferredLocationId") || "") || undefined,
    });
    toast.success("Perubahan disimpan");
    forceRefresh((n) => n + 1);
  }

  function handleToggleActive() {
    if (child!.isActive && !window.confirm("Nonaktifkan anggota ini? Akses akun orang tua terkait tidak berubah, tapi anak ini akan ditandai nonaktif.")) {
      return;
    }
    updateChild(child!.id, { isActive: !child!.isActive });
    toast.success(child!.isActive ? "Anggota dinonaktifkan" : "Anggota diaktifkan kembali");
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink to="/admin/members" label="Anggota" />
      <div>
        <h1 className="text-2xl font-semibold">{child.fullName}</h1>
        {parent ? (
          <p className="text-sm text-muted-foreground">
            Orang tua: {parent.fullName} — {parent.email} {parent.phone ? `— ${parent.phone}` : ""}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="childFullName">Nama Anak</Label>
            <Input id="childFullName" name="childFullName" defaultValue={child.fullName} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateOfBirth">Tanggal Lahir</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={child.dateOfBirth} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preferredLocationId">Lokasi Kolam Pilihan</Label>
            <Select id="preferredLocationId" name="preferredLocationId" defaultValue={child.preferredLocationId ?? ""}>
              <option value="">— Tidak ditentukan —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address">Alamat Rumah</Label>
          <Textarea id="address" name="address" defaultValue={child.address ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" name="notes" defaultValue={child.notes ?? ""} />
        </div>
        <Button type="submit" className="w-fit">
          Simpan Perubahan
        </Button>
      </form>

      <Button variant={child.isActive ? "destructive" : "secondary"} className="w-fit" onClick={handleToggleActive}>
        {child.isActive ? "Nonaktifkan Anggota" : "Aktifkan Kembali"}
      </Button>
    </div>
  );
}
