import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/lib/db";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CoachDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, forceRefresh] = useState(0);
  const coach = id ? getProfile(id) : undefined;

  if (!id || !coach || coach.role !== "coach") return <Navigate to="/admin/coaches" replace />;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateProfile(coach!.id, {
      fullName: String(formData.get("fullName")),
      phone: String(formData.get("phone") || "") || undefined,
    });
    toast.success("Perubahan disimpan");
    forceRefresh((n) => n + 1);
  }

  function handleToggleActive() {
    if (coach!.isActive && !window.confirm("Nonaktifkan pelatih ini? Pelatih tidak akan bisa login sampai diaktifkan kembali.")) {
      return;
    }
    updateProfile(coach!.id, { isActive: !coach!.isActive });
    toast.success(coach!.isActive ? "Pelatih dinonaktifkan" : "Pelatih diaktifkan kembali");
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <BackLink to="/admin/coaches" label="Pelatih" />
      <div>
        <h1 className="text-2xl font-semibold">{coach.fullName}</h1>
        <p className="text-sm text-muted-foreground">{coach.email}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nama Pelatih</Label>
          <Input id="fullName" name="fullName" defaultValue={coach.fullName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Telepon</Label>
          <Input id="phone" name="phone" defaultValue={coach.phone ?? ""} />
        </div>
        <Button type="submit" className="w-fit">
          Simpan Perubahan
        </Button>
      </form>
      <Button variant={coach.isActive ? "destructive" : "secondary"} className="w-fit" onClick={handleToggleActive}>
        {coach.isActive ? "Nonaktifkan Pelatih" : "Aktifkan Kembali"}
      </Button>
    </div>
  );
}
