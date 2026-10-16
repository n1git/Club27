import {
  BarChart3,
  CalendarDays,
  LandPlot,
  QrCode,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { PlatformModule } from "@/lib/data/platform-pricing";
import { Section } from "./section";

export const FEATURES = [
  {
    icon: Users,
    module: "members",
    title: "Anggota & keanggotaan",
    body: "Data anggota dengan pelatih dan kontak. Paket bulanan, kuartalan, tahunan, atau paket sesi. Tagihan langganan berulang terbit otomatis tiap awal bulan; paket sesi ditagih saat dibeli.",
  },
  {
    icon: CalendarDays,
    module: "classes",
    title: "Jadwal & kehadiran",
    body: "Kelas per lokasi dengan kapasitas. Basis data menolak pelatih yang dijadwalkan di dua kelas sekaligus. Pelatih mencatat kehadiran, dan pelatih pengganti bisa ditunjuk per kelas.",
  },
  {
    icon: LandPlot,
    module: "resource_booking",
    title: "Fasilitas & booking",
    body: "Lapangan, lintasan, studio, atau area dengan jam buka, slot, dan kapasitas. Booking melebihi kapasitas ditolak di basis data, termasuk saat beberapa orang memesan bersamaan. Anggota bisa booking sendiri dari portal.",
  },
  {
    icon: QrCode,
    module: "checkin",
    title: "Check-in QR untuk gym",
    body: "Layar di pintu menampilkan kode QR yang terus berganti; setiap kode hanya berlaku 30 sampai 60 detik. Anggota memindai dengan ponselnya. Alamat IP dan data perangkat tidak disimpan.",
  },
  {
    icon: ShoppingCart,
    module: "pos",
    title: "Kasir, produk & pesanan",
    body: "Jual produk dan tagih booking dalam satu pesanan. Stok tidak bisa terjual melebihi persediaan. Pembayaran tunai, transfer, atau QRIS dicatat manual, bisa dibagi, dan struknya bisa dicetak.",
  },
  {
    icon: Wallet,
    module: "cash_ledger",
    title: "Buku kas & gaji pelatih",
    body: "Setiap pembayaran tagihan dan kasir masuk ke buku kas secara otomatis. Entri tidak bisa diubah atau dihapus dari aplikasi; koreksi dicatat sebagai entri baru. Gaji pelatih dibukukan langsung ke buku kas.",
  },
  {
    icon: Smartphone,
    module: "member_portal",
    title: "Portal anggota",
    body: "Anggota masuk dengan satu akun untuk semua klub tempat ia terdaftar, lalu melihat paket, tagihan, jadwal, booking, dan pesanannya sendiri.",
  },
  {
    icon: UserCog,
    module: "members",
    title: "Peran & akses",
    body: "Pemilik, admin, pelatih, kepala pelatih, resepsionis, keuangan, dan anggota. Tiap peran hanya melihat menu dan data yang menjadi tugasnya.",
  },
  {
    icon: BarChart3,
    module: "members",
    title: "Laporan & dasbor",
    body: "Pendapatan dari tagihan, tunggakan, arus kas bulanan, biaya gaji, booking hari ini, okupansi fasilitas minggu ini, dan penjualan hari ini.",
  },
  {
    icon: SlidersHorizontal,
    module: "members",
    title: "Modul per klub",
    body: "Setiap klub bisa menyalakan atau mematikan modul yang tidak dipakai (modul anggota selalu aktif). Menu ikut menyesuaikan dan data tetap tersimpan.",
  },
];

const GROUPS = [
  { label: "Orang", titles: ["Anggota & keanggotaan", "Portal anggota", "Peran & akses"] },
  { label: "Operasional", titles: ["Jadwal & kehadiran", "Fasilitas & booking", "Check-in QR untuk gym", "Modul per klub"] },
  { label: "Uang dan laporan", titles: ["Kasir, produk & pesanan", "Buku kas & gaji pelatih", "Laporan & dasbor"] },
];

export function FeaturesSection({ modules }: { modules: PlatformModule[] }) {
  const status = new Map(modules.map((m) => [m.code, m.status]));
  const byTitle = new Map(FEATURES.map((f) => [f.title, f]));
  return (
    <Section
      id="fitur"
      eyebrow="Fitur"
      title="Semua pekerjaan klub dalam satu sumber data."
      intro="Dikelompokkan menurut pekerjaan yang biasa dilakukan pemilik, admin, pelatih, resepsionis, dan bagian keuangan."
    >
      <div className="flex flex-col gap-12">
        {GROUPS.map((group) => (
          <div key={group.label} className="grid gap-4 border-t border-foreground/80 pt-5 lg:grid-cols-[13rem_1fr] lg:gap-10">
            <h3 className="text-sm font-semibold text-accent-foreground">{group.label}</h3>
            <ul className="flex flex-col divide-y divide-border">
              {group.titles.map((title) => {
                const f = byTitle.get(title)!;
                const soon = status.get(f.module) === "soon";
                return (
                  <li key={f.title} className="grid gap-2 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8">
                    <div className="flex items-start gap-3">
                      <f.icon className="mt-0.5 size-5 shrink-0 text-accent-foreground" aria-hidden />
                      <div>
                        <h4 className="font-heading text-lg font-semibold leading-snug">{f.title}</h4>
                        {soon ? <span className="mt-1 inline-block rounded-sm border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">Segera hadir</span> : null}
                      </div>
                    </div>
                    <p className="text-pretty text-muted-foreground">{f.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        Semua waktu ditampilkan dalam WIB. Data setiap klub dipisahkan di tingkat basis data, sehingga pengguna hanya
        membaca data klub yang sedang aktif dan sesuai perannya.
      </p>
    </Section>
  );
}
