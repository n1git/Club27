import { useState } from "react";
import { toast } from "sonner";
import { createPromo, deletePromo, listPromo } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PromoPage() {
  const [, forceRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const promos = listPromo();
  const session = getSession();
  const now = new Date();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!session) return;
    const formData = new FormData(event.currentTarget);
    const file = formData.get("image");

    let imageUrl: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > 500 * 1024) {
        setError("Ukuran gambar maksimal 500KB untuk demo ini (localStorage terbatas)");
        return;
      }
      imageUrl = await readFileAsDataUrl(file);
    }

    createPromo({
      title: String(formData.get("title")),
      body: String(formData.get("body")),
      imageUrl,
      activeFrom: new Date(String(formData.get("activeFrom"))).toISOString(),
      activeUntil: formData.get("activeUntil")
        ? new Date(String(formData.get("activeUntil"))).toISOString()
        : undefined,
      authorId: session.userId,
    });
    toast.success("Promo berhasil ditambahkan");
    event.currentTarget.reset();
    forceRefresh((n) => n + 1);
  }

  function handleDelete(promoId: string) {
    if (!window.confirm("Hapus promo ini? Tindakan ini tidak bisa dibatalkan.")) return;
    deletePromo(promoId);
    toast.success("Promo dihapus");
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Promo</h1>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Tambah Promo Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Judul</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="body">Isi</Label>
              <Textarea id="body" name="body" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="image">Gambar (opsional, maks. 500KB)</Label>
              <Input id="image" name="image" type="file" accept="image/*" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="activeFrom">Aktif Mulai</Label>
                <Input
                  id="activeFrom"
                  name="activeFrom"
                  type="datetime-local"
                  required
                  defaultValue={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="activeUntil">Aktif Sampai (opsional)</Label>
                <Input id="activeUntil" name="activeUntil" type="datetime-local" />
              </div>
            </div>
            <Button type="submit" className="w-fit">
              Tambah Promo
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="text-sm font-semibold text-muted-foreground">Semua Promo</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {promos.map((p) => {
          const isActive = new Date(p.activeFrom) <= now && (!p.activeUntil || new Date(p.activeUntil) >= now);
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{p.title}</CardTitle>
                <Badge variant={isActive ? "success" : "secondary"}>{isActive ? "Aktif" : "Tidak Aktif"}</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="h-32 w-full rounded-md object-cover" />
                ) : null}
                <p className="text-sm text-muted-foreground">{p.body}</p>
                <Button variant="destructive" size="sm" className="w-fit" onClick={() => handleDelete(p.id)}>
                  Hapus
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {promos.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada promo.</p> : null}
      </div>
    </div>
  );
}
