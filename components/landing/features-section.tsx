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
