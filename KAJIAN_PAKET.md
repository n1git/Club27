# Paket Langganan 27 Club

Status: **dibangun** (migrasi `20250101000014_org_billing.sql`). Angka di bawah hanya bukti rancangan; nilai sebenarnya ada di tabel `subscription_plans` dan bisa diubah superadmin.

## 1. Model

- Langganan per **organisasi** (pemilik), bukan per klub. Satu organisasi punya satu paket, satu periode, dan satu status.
- Harga per **seat** yang dibeli (lihat bagian 4). Seat dipakai pemilik dan staf berperan berbayar; pelatih, kasir, peran gratis, dan anggota tidak memakai seat. Anggota tidak dibatasi. Minimal pembelian mengikuti `subscription_plans.min_seats` (2).
- Rumus: seat x harga per seat per bulan x bulan (bulanan 1, tahunan 12 - bulan gratis). Dihitung ulang di server lewat `platform_quote` (perpanjangan) dan `seat_quote` (tambah seat prorata); harga dari klien tidak dipakai.
- Komitmen bulanan atau tahunan. Tahunan = 12 dikurangi bulan gratis (awal: 0,5, jadi 11,5 bulan).

## 2. Satu paket: 27 Club Plus

| | 27 Club Plus |
|---|---|
| Harga | Rp 75.000 / seat / bulan, minimal 2 seat |
| Klub | maks 5 (bisa dinaikkan per organisasi oleh superadmin lewat `club_limit_override`) |
| Anggota dan lokasi | tak terbatas (FUP 1.000 anggota per klub, hanya teks, tidak ditegakkan di database) |
| Modul | semua modul `ready` |
| Trial | 30 hari (ditulis "1 bulan"), 1 seat, otomatis; tidak ada sistem kupon, tautan kupon hanya mengarah ke kontak |
| Tahunan | 11,5 bulan |

Contoh: bulanan 2 seat = Rp 150.000; bulanan 4 seat = Rp 300.000; tahunan 2 seat = 2 x 75.000 x 11,5 = Rp 1.725.000 (setara Rp 143.750/bulan). Pembelian atau perpanjangan dengan 1 seat ditolak (`min_seats`); perkiraan harga (`platform_quote`) selalu dihitung dari minimal 2 seat.

## 3. Modul (`platform_modules`)

Registri tanpa harga; semua modul `ready` termasuk di paket ini. Saat ini semuanya `ready`: Anggota, Paket Keanggotaan, Tagihan, Buku Kas, Jadwal & Presensi, Gaji Pelatih, Promo, Portal Anggota, Check-in, Fasilitas & Booking, Produk & Kasir. Modul yang aktif di sebuah klub tetap mengikuti jenis klubnya (`club_type_modules`) dan pengaturan per klub.

## 4. Aturan akses

- Status organisasi: `pending_verification` (email pendaftaran belum diverifikasi), `pending`, `trial`, `active`, `expired`, `suspended`, `cancelled`.
- Selain `trial` dan `active`, semua penulisan dari sesi pengguna ditolak (`SW003`): anggota, klub, seat, kelas, booking, kasir, check-in, penggajian, tagihan, dan lainnya. Membaca data, login, dan halaman langganan tetap jalan.
- Seat: harga dihitung dari seat yang dibeli, bukan dari jumlah pengguna. Orang dengan peran berbayar (Admin, Resepsionis, Keuangan, atau peran kustom berbayar) memakai satu seat per organisasi; pelatih, kasir, peran gratis, dan anggota tidak. Seat penuh menolak penambahan (`SW005`). Tambah seat saat langganan aktif ditagih prorata sesuai sisa hari periode; pengurangan lewat perpanjangan berlaku di periode berikutnya.
- Klub pertama organisasi tidak terkena `SW003` saat dibuat.
- Hanya `suspended` dan `cancelled` yang mematikan akses seluruh klub organisasi. Data tidak dihapus.
- Hapus organisasi: pemilik utama menghapus dari `/admin/klub/hapus` (nama organisasi dan kata sandi); langganan menjadi `cancelled`, semua klub nonaktif, dan data bisa dipulihkan 30 hari (`organizations.purge_after`). Setelah itu, atau setelah masa tenggang habis, organisasi masuk `purge_candidates()`. `purge_organization(org, execute)` mensimulasikan secara default; penghapusan nyata mati sampai `platform_flags.purge_enabled` dinyalakan dan tidak dipanggil cron. Akun login tidak dihapus; ringkasan penghapusan disimpan di `organization_purges`.
- Masa tenggang 365 hari setelah trial/periode berakhir: semua pengguna tetap bisa masuk dan membaca, perubahan ditolak. Setelah masa tenggang, atau saat `pending`/`pending_verification`, pemilik dan pemegang izin `billing.view` hanya bisa membuka halaman Langganan, pengguna lain keluar. Cron harian (`/api/cron/subscriptions`, 07.00 WIB) mengubah trial/periode yang lewat menjadi `expired` dan mengirim email pengingat H-7 dan H-1.
- Perpanjangan: pemilik mengajukan paket dan periode (`request_renewal`, harga dihitung ulang di server), superadmin mengonfirmasi pembayaran (`confirm_renewal`, idempoten, periode baru menyambung dari periode lama). Pembayaran lewat Midtrans Snap (notifikasi `/api/payments/midtrans` memanggil `confirm_renewal` dengan `provider = midtrans`); konfirmasi manual superadmin tetap tersedia.

## 5. Unit ekonomi (asumsi, wajib diverifikasi)

| Komponen | Asumsi | Dampak |
|---|---|---|
| Infrastruktur tetap | Vercel Pro ~$24 + Supabase Pro ~$25 + buffer ~$20-30 = Rp1,3 juta/bulan | Break-even ~18 seat Plus (Rp 75.000 per seat) |
| Biaya organisasi tambahan | ~Rp0 sampai pemakaian naik tier | Margin tinggi |

## 6. Pertanyaan terbuka

1. Apa yang terjadi pada data setelah masa tenggang berakhir (kebijakan retensi)? Belum diputuskan; penghapusan belum dijalankan.
2. Apakah diskon tahunan tetap 0,5 bulan, atau naik setelah ada data pelanggan?
3. Apakah batas 5 klub perlu berbeda per organisasi lewat penjualan, atau cukup override superadmin?
4. Invoice/kwitansi belum dirancang.
