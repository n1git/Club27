import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dasbor Admin</h1>
      <Card>
        <CardHeader>
          <CardTitle>Selamat datang</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ini adalah demo lokal berbasis localStorage. Gunakan menu di samping
          untuk mengelola anggota, jadwal, tagihan, buku kas, gaji pelatih,
          promo, dan laporan. Semua data hanya tersimpan di peramban ini.
        </CardContent>
      </Card>
    </div>
  );
}
