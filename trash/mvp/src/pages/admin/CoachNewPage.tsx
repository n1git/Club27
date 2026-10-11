import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createAccount } from "@/lib/db";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CoachNewPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = createAccount({
      role: "coach",
      fullName: String(formData.get("fullName")),
      email: String(formData.get("email")),
      phone: String(formData.get("phone") || "") || undefined,
      password: "coach123",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Pelatih berhasil ditambahkan");
    navigate("/admin/coaches");
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <BackLink to="/admin/coaches" label="Pelatih" />
      <h1 className="text-2xl font-semibold">Tambah Pelatih</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nama Pelatih</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Telepon</Label>
          <Input id="phone" name="phone" />
        </div>
        <Button type="submit" className="w-fit">
          Tambah Pelatih
        </Button>
      </form>
    </div>
  );
}
