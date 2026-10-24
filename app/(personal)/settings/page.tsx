import { requireRole } from "@/lib/auth/guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteAccountForm } from "@/components/shared/delete-account-form";
import { MyConsentsCard } from "@/components/shared/my-consents-card";
import { getAccountConsents } from "@/lib/data/consents";

const ERRORS: Record<string, string> = {
  sandi: "Kata sandi konfirmasi salah.",
  batas: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
  gagal: "Ekspor gagal dibuat. Coba lagi nanti.",
  data: "Permintaan tidak valid.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ galat?: string }> }) {
  const user = await requireRole("personal");
  const [{ galat }, consents] = await Promise.all([searchParams, getAccountConsents(user.accountId)]);
  const error = galat ? ERRORS[galat] : null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pengaturan" />
      <Card>
        <CardHeader>
          <CardTitle>Akun</CardTitle>
          <CardDescription>Foto profil, nama, username, kontak, profil publik, organisasi, dan kata sandi.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/account" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Buka pengaturan akun
          </Link>
        </CardContent>
      </Card>
      <MyConsentsCard consents={consents} />
      <Card>
        <CardHeader>
          <CardTitle>Ekspor data</CardTitle>
          <CardDescription>
            Unduh data akun Anda (latihan, teman, postingan, komentar, grup, event, permintaan gabung klub) sebagai ZIP berisi CSV. Data klub tempat Anda
            menjadi anggota dikelola klub dan tidak ikut.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <form method="post" action="/api/export/account" className="flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-password">Konfirmasi dengan kata sandi Anda</Label>
              <Input id="export-password" name="confirmPassword" type="password" required maxLength={128} autoComplete="current-password" />
            </div>
            <Button type="submit" variant="outline" className="w-fit">
              Unduh ZIP
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Hapus akun</CardTitle>
          <CardDescription>
            Menghapus akun, profil, catatan latihan, catatan kesehatan, teman, postingan, komentar, grup yang Anda buat, dan event. Tidak bisa dibatalkan. Akun yang masih
            terhubung ke klub atau organisasi tidak bisa dihapus dari sini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
