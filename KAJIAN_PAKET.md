# Paket Langganan 27 Club

Status: **dibangun** (migrasi `20250101000014_org_billing.sql`). Angka di bawah hanya bukti rancangan; nilai sebenarnya ada di tabel `subscription_plans` dan bisa diubah superadmin.

## 1. Model

- Langganan per **organisasi** (pemilik), bukan per klub. Satu organisasi punya satu paket, satu periode, dan satu status.
- Harga per **pengguna internal**: pemilik aktif ditambah admin, pelatih, resepsionis, dan keuangan aktif di semua klub organisasi. Akun admin milik pemilik di tiap klub tidak dihitung lagi (pemilik dihitung satu kali). Anggota tidak dihitung dan tidak dibatasi. Minimal 1 pengguna.
- Rumus: pengguna x harga per pengguna per bulan x bulan (bulanan 1, tahunan 12 - bulan gratis). Dihitung ulang di server lewat fungsi `platform_quote`; harga dari klien tidak dipakai.
- Komitmen bulanan atau tahunan. Tahunan = 12 dikurangi bulan gratis (awal: 0,5, jadi 11,5 bulan).

## 2. Dua paket

| | Standard | Advanced |
|---|---|---|
| Harga | Rp 150.000 / pengguna / bulan | Rp 250.000 / pengguna / bulan |
| Klub | maks 3 (bisa dinaikkan per organisasi oleh superadmin) | tak terbatas |
| Anggota dan lokasi | tak terbatas | tak terbatas |
| Modul | semua modul `ready` | semua modul `ready` |
| Trial | 30 hari | tidak ada; mulai `pending` sampai diaktifkan |
| Tahunan | 11,5 bulan | 11,5 bulan |

Contoh: Standard bulanan 4 pengguna = Rp 600.000; Standard tahunan 4 pengguna = 4 x 150.000 x 11,5 = Rp 6.900.000 (setara Rp 575.000/bulan); Advanced bulanan 2 pengguna = Rp 500.000.

## 3. Modul (`platform_modules`)

Registri tanpa harga; semua modul `ready` termasuk di kedua paket. Saat ini semuanya `ready`: Anggota, Paket Keanggotaan, Tagihan, Buku Kas, Jadwal & Presensi, Gaji Pelatih, Promo, Portal Anggota, Check-in, Fasilitas & Booking, Produk & Kasir. Modul yang aktif di sebuah klub tetap mengikuti jenis klubnya (`club_type_modules`) dan pengaturan per klub.

## 4. Aturan akses

- Status organisasi: `pending_verification` (email pendaftaran belum diverifikasi), `pending`, `trial`, `active`, `expired`, `suspended`, `cancelled`.
- `pending_verification`, `pending`, `trial` yang lewat tanggal akhir, `suspended`, dan `cancelled` menolak tambahan anggota, klub, dan pengguna internal, serta kelas baru, booking kelas dan fasilitas, pesanan kasir, check-in, penggajian, dan pembuatan tagihan (`SW003`). Membaca data, melunasi tagihan yang sudah ada, login, dan halaman langganan tetap jalan.
- Klub pertama organisasi tidak terkena `SW003` saat dibuat.
- Hanya `suspended` dan `cancelled` yang mematikan akses seluruh klub organisasi. Data tidak dihapus.
- `pending`, `expired`, serta `trial`/`active` yang lewat tanggal akhir mengunci akses klub: pemilik hanya bisa membuka halaman Langganan, pengguna lain keluar dengan pesan langganan berakhir. Cron harian (`/api/cron/subscriptions`, 07.00 WIB) mengubah trial/periode yang lewat menjadi `expired` dan mengirim email pengingat H-7 dan H-1.
- Perpanjangan: pemilik mengajukan paket dan periode (`request_renewal`, harga dihitung ulang di server), superadmin mengonfirmasi pembayaran (`confirm_renewal`, idempoten, periode baru menyambung dari periode lama). Payment gateway nanti cukup memanggil `confirm_renewal` dengan `provider` dan `provider_ref`.

## 5. Unit ekonomi (asumsi, wajib diverifikasi)

| Komponen | Asumsi | Dampak |
|---|---|---|
| Infrastruktur tetap | Vercel Pro ~$24 + Supabase Pro ~$25 + buffer ~$20-30 = Rp1,3 juta/bulan | Break-even ~9 pengguna Standard atau ~6 pengguna Advanced |
| Biaya organisasi tambahan | ~Rp0 sampai pemakaian naik tier | Margin tinggi |

## 6. Pertanyaan terbuka

1. Apakah Advanced perlu trial singkat? Sekarang Advanced hanya bisa dipakai setelah pembayaran.
2. Apakah diskon tahunan tetap 0,5 bulan, atau naik setelah ada data pelanggan?
3. Apakah batas klub Standard (3) perlu berbeda per organisasi lewat penjualan, atau cukup override superadmin?
4. Invoice/kwitansi 27 Club, payment gateway, dan proration belum dirancang.
