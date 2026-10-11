import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createClass, listClassTypes, listLocations, listProfilesByRole } from "@/lib/db";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ClassNewPage() {
  const navigate = useNavigate();
  const coaches = listProfilesByRole("coach").filter((c) => c.isActive);
  const locations = listLocations();
  const classTypes = listClassTypes();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const startTime = new Date(String(formData.get("startTime"))).toISOString();
    const endTime = new Date(String(formData.get("endTime"))).toISOString();
    const result = createClass({
      instructorId: String(formData.get("instructorId")),
      locationId: String(formData.get("locationId")),
      classTypeId: String(formData.get("classTypeId")),
      startTime,
      endTime,
      capacity: Number(formData.get("capacity")),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Kelas berhasil ditambahkan");
    navigate("/admin/schedule");
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <BackLink to="/admin/schedule" label="Jadwal Kelas" />
      <h1 className="text-2xl font-semibold">Tambah Kelas</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="instructorId">Pelatih</Label>
          <Select id="instructorId" name="instructorId" required defaultValue="">
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
            <Label htmlFor="locationId">Lokasi</Label>
            <Select id="locationId" name="locationId" required defaultValue="">
              <option value="" disabled>
                Pilih lokasi
              </option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="classTypeId">Jenis Kelas</Label>
            <Select id="classTypeId" name="classTypeId" required defaultValue="">
              <option value="" disabled>
                Pilih jenis kelas
              </option>
              {classTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startTime">Waktu Mulai</Label>
            <Input id="startTime" name="startTime" type="datetime-local" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endTime">Waktu Selesai</Label>
            <Input id="endTime" name="endTime" type="datetime-local" required />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capacity">Kapasitas</Label>
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={8} required />
        </div>
        <Button type="submit" className="w-fit">
          Simpan Kelas
        </Button>
      </form>
    </div>
  );
}
