import { requireOwner } from "@/lib/auth/owner";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  sandi: "Kata sandi konfirmasi salah.",
  batas: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
  gagal: "Ekspor gagal dibuat. Coba lagi nanti.",
  data: "Permintaan tidak valid.",
};

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ galat?: string }> }) {
  await requireOwner();
  const { galat } = await searchParams;
  const error = galat ? ERRORS[galat] : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Ekspor data</>} />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Unduh seluruh data organisasi (semua klub) sebagai file ZIP berisi CSV yang bisa dibuka di Excel atau Google Sheets: anggota, tagihan,
        kelas, kasir, buku kas, penggajian, check-in, staf, dan log audit. Kata sandi dan rahasia sistem tidak disertakan. Gambar promo tidak
        ikut diekspor.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form method="post" action="/api/export/organization" className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-password">Konfirmasi dengan kata sandi Anda</Label>
          <Input id="export-password" name="confirmPassword" type="password" required maxLength={128} autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-fit">
          Unduh ZIP
        </Button>
      </form>
    </div>
  );
}
