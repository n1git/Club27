import { formatRupiah, trialLabel, type PricingPlan } from "@/lib/pricing";
import type { PublicClubType } from "@/lib/club-type";

export interface SportFaq {
  q: string;
  a: string;
}

export interface SportContent {
  tagline: string;
  intro: string;
  uses: string[];
  faq: SportFaq[];
}

const WALK_IN =
  "Staf bisa membuat booking atas nama tamu (nama dan nomor telepon) dan menagihnya di kasir. Pelanggan belum bisa booking sendiri tanpa akun anggota dan paket aktif.";

const CONTENT: Record<string, SportContent> = {
  swimming: {
    tagline: "Kelas, lintasan, dan tagihan anggota klub renang dalam satu aplikasi.",
    intro:
      "Klub renang menjadwalkan kelas per kolam dan pelatih, mencatat kehadiran, lalu menagih paket bulanan atau paket sesi. Lintasan bisa dibooking per slot dengan kapasitas per lintasan.",
    uses: [
      "Jadwal kelas per lokasi kolam; pelatih pengganti bisa ditunjuk per kelas",
      "Booking lintasan per slot; saran awal 4 lintasan berkapasitas 4 orang, bisa diubah",
      "Paket bulanan atau paket sesi, dengan tagihan berulang yang terbit otomatis",
    ],
    faq: [
      {
        q: "Apakah satu kolam bisa punya banyak lintasan?",
        a: "Bisa. Setiap lintasan punya jam buka, durasi slot, dan kapasitas sendiri. Booking yang melebihi kapasitas ditolak oleh database.",
      },
    ],
  },
  gym: {
    tagline: "Check-in QR, paket member, dan kasir untuk gym.",
    intro:
      "Gym memakai layar QR berputar di pintu untuk check-in member, menghitung sesi dari kunjungan, dan menjual produk di kasir. Kelas dan area latihan bisa dijadwalkan dan dibooking.",
    uses: [
      "Check-in QR yang berganti tiap 30 detik; alamat IP dan data perangkat tidak disimpan",
      "Paket sesi yang berkurang dari check-in, bukan dari absensi manual",
      "Jadwal kelas dengan pelatih dan kasir untuk minuman atau suplemen",
    ],
    faq: [
      {
        q: "Apakah check-in bisa dipalsukan dengan foto QR?",
        a: "Setiap kode hanya berlaku 30 sampai 60 detik, jadi foto kode tidak berguna setelahnya. Check-in juga ditolak untuk anggota nonaktif atau tanpa paket aktif.",
      },
    ],
  },
  tennis: {
    tagline: "Booking lapangan, anggota, dan kasir untuk klub tenis.",
    intro:
      "Klub tenis mengatur jam buka dan slot tiap lapangan, menerima booking dari staf atau anggota, lalu menagihnya di kasir. Anggota melihat paket dan booking mereka dari portal.",
    uses: [
      "Booking lapangan per slot 60 menit; saran awal 2 lapangan, bisa diubah",
      "Anggota booking sendiri dari portal selama paketnya aktif",
      "Kasir untuk sewa raket, minuman, atau booking yang ditagihkan",
    ],
    faq: [{ q: "Bisakah tamu non-anggota memakai lapangan?", a: WALK_IN }],
  },
  padel: {
    tagline: "Booking lapangan, anggota, dan kasir untuk klub padel.",
    intro:
      "Klub padel mengelola beberapa lapangan dengan jam buka dan slot sendiri. Booking masuk dari staf atau anggota, dan pembayaran dicatat di kasir serta buku kas.",
    uses: [
      "Beberapa lapangan padel dengan jam buka per hari",
      "Booking dari staf atau anggota; slot yang penuh ditolak otomatis",
      "Pesanan kasir yang bisa menagih booking sekaligus produk",
    ],
    faq: [{ q: "Bisakah tamu non-anggota memakai lapangan?", a: WALK_IN }],
  },
  pilates: {
    tagline: "Jadwal kelas, studio, dan paket sesi untuk studio pilates.",
    intro:
      "Studio pilates menjadwalkan kelas dengan instruktur dan kapasitas per kelas, mencatat kehadiran, dan menjual paket sesi. Studio bisa dibooking dan dikaitkan ke kelas.",
    uses: [
      "Kelas dengan kapasitas; saran awal studio berkapasitas 12 orang",
      "Paket sesi yang ditagih saat dibeli",
      "Kehadiran dicatat instruktur, gaji instruktur dibukukan ke buku kas",
    ],
    faq: [
      {
        q: "Apakah kelas bisa memakai ruang studio tertentu?",
        a: "Bisa. Kelas dapat dikaitkan ke satu studio; booking studio untuk kelas itu otomatis mengambil satu tempat dan ikut berpindah bila kelas dipindah.",
      },
    ],
  },
  yoga: {
    tagline: "Kelas, instruktur, dan paket untuk studio yoga.",
    intro:
      "Studio yoga mengatur jadwal kelas per lokasi dan instruktur, menerima anggota yang mendaftar kelas, dan menagih paket keanggotaan. Semua pembayaran tercatat di buku kas.",
    uses: [
      "Jadwal kelas per lokasi dengan instruktur pengganti bila perlu",
      "Studio dengan kapasitas; saran awal 20 orang per studio",
      "Paket bulanan atau paket sesi dengan tagihan otomatis",
    ],
    faq: [
      {
        q: "Bagaimana kehadiran kelas dicatat?",
        a: "Instruktur mencatat kehadiran per kelas. Pada klub yang memakai paket sesi, kehadiran itu mengurangi sisa sesi anggota.",
      },
    ],
  },
  futsal: {
    tagline: "Booking lapangan futsal per jam, akademi, dan kasir.",
    intro:
      "Penyewaan lapangan futsal berjalan per slot 60 menit dengan kapasitas satu tim per lapangan. Klub yang punya akademi menambahkan jadwal kelas, paket anggota, dan gaji pelatih.",
    uses: [
      "Booking per jam; saran awal 1 lapangan berkapasitas 1, bisa ditambah",
      "Jadwal kelas untuk akademi futsal dengan pelatih",
      "Kasir untuk sewa, minuman, atau perlengkapan",
    ],
    faq: [{ q: "Bisakah pelanggan umum menyewa lapangan?", a: WALK_IN }],
  },
  badminton: {
    tagline: "Booking lapangan badminton, klub anggota, dan kasir.",
    intro:
      "GOR badminton biasanya punya beberapa lapangan sekaligus. Setiap lapangan punya jam buka dan slot sendiri, dan klub dengan kelas atau akademi bisa menjadwalkannya juga.",
    uses: [
      "Booking per slot 60 menit; saran awal 4 lapangan, bisa diubah",
      "Kelas pembinaan dengan pelatih dan presensi",
      "Kasir untuk sewa lapangan, shuttlecock, dan minuman",
    ],
    faq: [{ q: "Bisakah pelanggan umum menyewa lapangan?", a: WALK_IN }],
  },
  mini_soccer: {
    tagline: "Booking lapangan mini soccer per jam dan kasir.",
    intro:
      "Lapangan mini soccer dibooking per slot dengan kapasitas satu tim. Staf mencatat booking tamu atau anggota, lalu menagihnya lewat kasir dan buku kas.",
    uses: [
      "Booking per jam; saran awal 1 lapangan, bisa ditambah",
      "Anggota dengan paket aktif booking sendiri dari portal",
      "Pembayaran tunai, transfer, atau QRIS dicatat manual di kasir",
    ],
    faq: [{ q: "Bisakah pelanggan umum menyewa lapangan?", a: WALK_IN }],
  },
  basketball: {
    tagline: "Booking lapangan basket, akademi, dan kasir.",
    intro:
      "Klub basket mengatur booking lapangan per slot dan, bila punya pembinaan, jadwal kelas dengan pelatih. Anggota dan pembayaran tercatat di satu akun organisasi.",
    uses: [
      "Booking lapangan per slot 60 menit",
      "Jadwal kelas dan presensi untuk pembinaan",
      "Paket anggota, kasir, dan buku kas",
    ],
    faq: [{ q: "Bisakah pelanggan umum menyewa lapangan?", a: WALK_IN }],
  },
  volleyball: {
    tagline: "Booking lapangan voli, kelas, dan kasir.",
    intro:
      "Klub voli menjadwalkan latihan dan booking lapangan dalam satu aplikasi. Anggota melihat paket dan booking mereka dari portal.",
    uses: [
      "Booking lapangan per slot 60 menit",
      "Jadwal kelas latihan dengan pelatih",
      "Paket anggota dan tagihan berulang",
    ],
    faq: [{ q: "Bisakah pelanggan umum menyewa lapangan?", a: WALK_IN }],
  },
  pickleball: {
    tagline: "Booking lapangan pickleball, anggota, dan kasir.",
    intro:
      "Klub pickleball mengelola beberapa lapangan dengan jam buka dan slot sendiri. Booking dari staf atau anggota dicatat, dan pembayarannya masuk kasir.",
    uses: [
      "Booking per slot 60 menit; saran awal 2 lapangan",
      "Booking sendiri oleh anggota dengan paket aktif",
      "Kasir untuk sewa lapangan dan perlengkapan",
    ],
    faq: [{ q: "Bisakah pelanggan umum menyewa lapangan?", a: WALK_IN }],
  },
  table_tennis: {
    tagline: "Booking meja tenis meja per jam, anggota, dan kasir.",
    intro:
      "Klub tenis meja menyewakan meja per slot. Setiap meja punya jam buka dan kapasitas sendiri, dan anggota yang punya paket aktif bisa booking dari portal.",
    uses: [
      "Booking meja per slot 60 menit; saran awal 4 meja",
      "Paket anggota dan tagihan berulang",
      "Kasir untuk sewa meja, bet, dan minuman",
    ],
    faq: [{ q: "Bisakah pelanggan umum menyewa meja?", a: WALK_IN }],
  },
  crossfit: {
    tagline: "Kelas WOD, check-in QR, dan paket untuk box CrossFit.",
    intro:
      "Box CrossFit menjadwalkan kelas dengan kapasitas, memakai check-in QR di pintu, dan menagih paket keanggotaan. Box bisa dibooking dan dikaitkan ke kelas.",
    uses: [
      "Kelas dengan kapasitas; saran awal box berkapasitas 15 orang",
      "Check-in QR berputar di pintu box",
      "Paket sesi atau bulanan, kasir, dan gaji pelatih",
    ],
    faq: [
      {
        q: "Apakah CrossFit memakai check-in QR?",
        a: "Ya. Modul check-in aktif untuk CrossFit: layar di pintu menampilkan kode yang berganti, dan anggota memindainya dengan ponsel.",
      },
    ],
  },
  martial_arts: {
    tagline: "Kelas latihan, presensi, dan paket untuk perguruan bela diri.",
    intro:
      "Perguruan atau dojo menjadwalkan kelas per area latihan dengan pelatih, mencatat kehadiran, dan menagih iuran anggota. Area latihan bisa dibooking dengan kapasitas sendiri.",
    uses: [
      "Kelas dengan kapasitas; saran awal area berkapasitas 20 orang",
      "Presensi oleh pelatih, pelatih pengganti per kelas",
      "Iuran bulanan atau paket sesi, kasir, dan buku kas",
    ],
    faq: [
      {
        q: "Bisakah banyak cabang bela diri dikelola bersama?",
        a: "Satu organisasi bisa punya beberapa klub sesuai batas klub paketnya, jadi tiap cabang atau dojo bisa menjadi klub tersendiri dengan data terpisah, dikelola dari akun pemilik yang sama.",
      },
    ],
  },
  dance: {
    tagline: "Jadwal kelas, studio, dan paket untuk studio dance.",
    intro:
      "Studio dance menjadwalkan kelas dengan instruktur per studio, mencatat kehadiran, dan menjual paket kelas. Studio bisa dibooking dan dikaitkan ke kelas.",
    uses: [
      "Kelas per studio dengan kapasitas; saran awal 20 orang",
      "Paket kelas bulanan atau paket sesi",
      "Kasir dan buku kas untuk setiap pembayaran",
    ],
    faq: [
      {
        q: "Apakah studio bisa dibooking di luar kelas?",
        a: "Bisa. Studio punya jam buka dan slot sendiri; booking dari staf atau anggota diperiksa agar tidak bentrok dengan kelas.",
      },
    ],
  },
  running: {
    tagline: "Jadwal sesi latihan, anggota, dan iuran untuk komunitas lari.",
    intro:
      "Komunitas lari menjadwalkan sesi latihan di titik kumpul dengan pelatih, mencatat kehadiran, dan menagih iuran anggota. Tanpa booking fasilitas dan kasir, jadi menunya ringkas.",
    uses: [
      "Jadwal sesi latihan per titik kumpul dengan kapasitas",
      "Iuran bulanan atau paket sesi dengan tagihan otomatis",
      "Anggota yang juga punya akun Ruzz bisa mencatat latihan dan ikut tantangan",
    ],
    faq: [
      {
        q: "Apakah komunitas lari punya booking fasilitas atau kasir?",
        a: "Tidak. Jenis ini hanya memakai anggota, paket, tagihan, jadwal sesi, buku kas, gaji pelatih, promo, dan portal anggota. Modul lain tidak ditampilkan.",
      },
    ],
  },
  other: {
    tagline: "Aplikasi klub untuk olahraga lain: anggota, jadwal, booking, dan kasir.",
    intro:
      "Jenis Lainnya cocok untuk olahraga yang belum punya halaman sendiri. Istilahnya netral, dan semua modul inti tersedia: anggota, paket, jadwal kelas, booking fasilitas, kasir, dan buku kas.",
    uses: [
      "Fasilitas dengan nama, jam buka, dan kapasitas yang Anda tentukan",
      "Jadwal kelas dengan pelatih dan presensi",
      "Paket anggota, kasir, dan portal anggota",
    ],
    faq: [
      {
        q: "Olahraga saya tidak ada di daftar. Apakah bisa memakai Ruzz?",
        a: "Pilih Lainnya saat mendaftar. Jenis olahraga baru ditambahkan lewat data, jadi daftar ini bisa bertambah tanpa perubahan aplikasi.",
      },
    ],
  },
};

export function sportContent(type: PublicClubType, has: (module: string) => boolean): SportContent {
  const known = CONTENT[type.code];
  if (known) return known;
  const parts = [`${type.terms.member} dan ${type.terms.coach.toLowerCase()}`];
  if (has("classes")) parts.push(`jadwal ${type.terms.session.toLowerCase()}`);
  if (has("resource_booking")) parts.push(`booking ${type.terms.resource.toLowerCase()}`);
  if (has("pos")) parts.push("kasir");
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, dan ${parts[parts.length - 1]}` : parts[0];
  return {
    tagline: `Kelola ${list} untuk ${type.name}.`,
    intro: `${type.name} memakai ${list} dalam satu aplikasi, dengan istilah yang disesuaikan.`,
    uses: parts.map((p) => `${p[0].toUpperCase()}${p.slice(1)}`),
    faq: [],
  };
}

export function commonFaq(type: PublicClubType, plans: PricingPlan[]): SportFaq[] {
  const plan = plans[0];
  const out: SportFaq[] = [];
  if (plan) {
    const trial = plan.trialDays > 0 ? ` Trial gratis ${trialLabel(plan.trialDays)} tanpa kartu kredit.` : "";
    const yearly = plan.yearlyFreeMonths > 0 ? ` Bayar tahunan gratis ${plan.yearlyFreeMonths} bulan.` : "";
    out.push({
      q: `Berapa biaya aplikasi untuk ${type.name}?`,
      a: `${plan.name} ${formatRupiah(plan.pricePerUserMonth)} per seat per bulan, minimal ${plan.minSeats} seat. Seat dipakai pemilik, admin, resepsionis, dan keuangan; pelatih, kasir, dan anggota tidak memakai seat.${trial}${yearly}`,
    });
  }
  out.push(
    {
      q: "Apakah jumlah anggota dibatasi?",
      a: "Tidak ada batas jumlah anggota di database. Ada kebijakan pemakaian wajar sekitar 1.000 anggota per klub.",
    },
    {
      q: "Apakah ada aplikasi mobile?",
      a: "Belum ada aplikasi mobile. Ruzz dipakai lewat browser di ponsel maupun komputer.",
    },
  );
  return out;
}
