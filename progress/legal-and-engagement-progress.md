# legal-and-engagement

Bagian A: kepatuhan UU PDP. Bagian B: fitur kompetitif dan sosial. Bagian B baru dikerjakan setelah A selesai dan owner memberi OK.

## Status
Fase 0 selesai (rencana). Menunggu OK owner.

- [x] Fase 0: rencana
- [ ] Fase 1: migrasi 061 dan kode A2-A7, A9
- [ ] Fase 2: kwitansi, DPIA, rencana respons insiden, aturan A10 (lalu tunggu OK)
- [ ] Fase 3: migrasi 062, peringkat, tantangan, lencana, rekor, streak
- [ ] Fase 4: migrasi 063, foto post, reaksi, kartu bagikan

## Teks persetujuan (`lib/consent.ts`, `CONSENT_VERSION = "2026-10-20"`)

Label centang: "Saya berusia 18 tahun ke atas dan menyetujui Syarat & Ketentuan dan Kebijakan Privasi". Di bawahnya ada `<details>` "Lihat rincian persetujuan" yang memuat butir berikut.

1. Usia. Saya berusia 18 tahun ke atas. Anak di bawah 18 tahun hanya dapat didaftarkan oleh klub dengan persetujuan orang tua atau wali.
2. Penyedia infrastruktur dan transfer ke luar negeri. Data saya diproses oleh penyedia berikut, dan sebagian disimpan atau diproses di luar Indonesia:
   - Supabase: basis data dan penyimpanan berkas, Jepang (Tokyo, `ap-northeast-1`, dicek di project hosted);
   - Vercel: hosting aplikasi, Amerika Serikat (wilayah fungsi bawaan; belum dikonfirmasi di dashboard, lihat "Perlu keputusan");
   - Resend: pengiriman email, Amerika Serikat;
   - Cloudflare Turnstile: pemeriksaan anti-bot saat mendaftar, Amerika Serikat;
   - Midtrans: pembayaran langganan, Indonesia.
3. Masa simpan:
   - data akun dan klub disimpan selama akun atau langganan berjalan;
   - setelah langganan berakhir, data klub hanya bisa dibaca selama satu tahun;
   - log audit disimpan 5 tahun;
   - akun pribadi yang tidak login selama 3 tahun dapat dihapus;
   - catatan keuangan dapat disimpan lebih lama bila diwajibkan peraturan.
4. Bukti persetujuan (versi, tanggal, jenis persetujuan) tetap disimpan setelah akun dihapus, untuk membuktikan dasar pemrosesan. Isinya tanpa data lain.
5. Bila terjadi kegagalan pelindungan data pribadi, kami memberi tahu Anda dan lembaga yang berwenang paling lambat 3 x 24 jam setelah diketahui.
6. Kontak pejabat pelindungan data: ditampilkan lewat `LegalContact` (email dan WhatsApp dari `NEXT_PUBLIC_CONTACT_*`).

Nama penyedia hanya ada di `lib/consent.ts`. Di `/privacy` hanya ditambah "foto postingan" di daftar data akun pribadi, dan kalimat "Rincian persetujuan Anda dapat dilihat di Pengaturan akun."

Persetujuan data kesehatan (`consents.kind = 'health_data'`), layar terpisah di `/home/health`:
"Saya setuju Ruzz menyimpan tinggi dan berat badan saya untuk menghitung IMT. Data ini hanya dapat dilihat oleh saya, tidak ditampilkan ke klub, pelatih, teman, grup, feed, atau peringkat. Saya dapat menarik persetujuan kapan saja di Pengaturan, dan semua catatan kesehatan saya akan dihapus."

## Cara tiap peran sampai ke fitur

Semua orang login ke `/home` (sesi `personal`) dulu. Pemilik dan staf masuk ke `/admin` lewat "Masuk" di Beranda dan kembali lewat "Akun saya". Anggota masuk ke `/member` dengan cara yang sama.

"Anak" = akun yang punya profil `member` aktif (`club_profiles.role = 'member'` dengan `account_id`) dan `club_members.date_of_birth` di bawah 18 tahun (`isMinor`) di klub mana pun. Diperiksa di server lewat `isSocialRestricted(accountId)` = `isSocialBanned` atau anak.

| Fitur | Personal | Pemilik/staf | Anggota dewasa | Anggota anak |
|---|---|---|---|---|
| Centang persetujuan | `/signup/account` | `/signup` (klub), "Buat organisasi" di `/home`, undangan akun baru | `/signup/account` atau aktivasi klub | tidak mendaftar sendiri (didaftarkan klub; persetujuan wali di `member_consent_fields`) |
| Kartu "Persetujuan saya" | `/home/settings` | `/home/settings` | `/home/settings` | `/home/settings` |
| Kesehatan (`/home/health`) | ya, setelah persetujuan | ya | ya | tidak (menu disembunyikan, aksi ditolak) |
| Latihan pribadi, rekor, streak, lencana | ya | ya | ya | ya, tanpa tombol "Bagikan ke feed" |
| Teman, feed, foto, reaksi | ya | ya | ya | tidak |
| Grup, event, tantangan grup | ya | ya | ya | tidak |
| Peringkat klub dan tantangan klub | lewat klub yang diikuti | ya | ya (opt-in) | tidak |
| Kelola tantangan klub | - | izin `challenges.manage` di `/admin/challenges` | - | - |
| Kartu bagikan | ya | ya | ya | tidak |
| Kwitansi | - | izin `billing.view` | - | - |

## Migrasi

- `20250101000061_consent_compliance.sql` (A5, A7, A8, A9):
  - `consents.kind` ditambah `health_data`;
  - kolom `consents.revoked_at`; trigger yang menolak delete dan menolak update selain mengisi `revoked_at` atau mengosongkan `guardian_name`;
  - policy select/insert `health_data` untuk akun sendiri (atau lewat service role di aksi server);
  - RPC `withdraw_health_consent()`: isi `revoked_at` dan hapus `body_measurements` milik akun dalam satu transaksi;
  - trigger `body_measurements` menolak insert/update tanpa persetujuan aktif (`BM003`), supaya PostgREST langsung juga terkunci;
  - `subscription_renewals.receipt_no` unik (`RZ-YYYYMM-NNNN`, urutan per bulan WIB dengan kunci), diisi di `confirm_renewal`;
  - `retention_candidates()` (service role): `audit_log` > 5 tahun, akun tanpa klub/organisasi dengan `last_login_at` > 3 tahun; hanya mendaftar.
  - Kandidat akun tidak aktif memakai `accounts.last_login_at` (sudah ada sejak migrasi 039).
- `20250101000062_competition.sql` (B11-B14):
  - `club_types.max_m_per_min` dan `WL003`;
  - `leaderboard_rows` mendapat `prev_rank` dan `gap_to_next`, dan fungsi juara periode lalu;
  - `challenges`, `challenge_participants`, fungsi progres;
  - izin `challenges.manage`;
  - `achievement_types`, `achievements` dan trigger.
- `20250101000063_post_media_reactions.sql` (B16, B17):
  - bucket privat `post-media`, tabel `post_media`;
  - `posts.hidden_at` dan trigger laporan (3 terbuka);
  - `post_reactions.kind`, `kudos_for_posts` diperbarui.
- Tiap tabel baru dicek di `accounts_phase1.sql` dan `seats_phase4.sql`. `challenges` (ber-`club_id`) dipasangi `a00_org_writable` dan masuk `lib/export/organization.ts` serta `purge_organization`.
- Setiap migrasi diuji di database lokal baru dan dengan begin/rollback di hosted. `apply_migration` dijalankan hanya setelah OK owner. Kode yang membaca tabel baru tidak di-push sebelum migrasinya ada di hosted, karena setiap push ke `main` langsung ter-deploy (pelajaran dari health-tracking).

## Mock layar

Persetujuan saat daftar (keempat form):
```
[ ] Saya berusia 18 tahun ke atas dan menyetujui Syarat & Ketentuan
    dan Kebijakan Privasi
    > Lihat rincian persetujuan
      1. Usia ...
      2. Penyedia dan negara: Supabase (Jepang), Vercel (AS), ...
      3. Masa simpan ...   4. Bukti persetujuan ...   5. Insiden 3x24 jam ...
      6. Kontak: email / WhatsApp
[ Daftar ]
```

`/home/health` sebelum persetujuan:
```
KESEHATAN
+--------------------------------------------------+
| Persetujuan data kesehatan                       |
| Saya setuju Ruzz menyimpan tinggi dan berat ...  |
| [ ] Saya setuju                                  |
| [ Setujui dan lanjutkan ]                        |
+--------------------------------------------------+
```

`/home/settings`, kartu "Persetujuan saya":
```
Persetujuan saya
Syarat & Privasi   versi 2026-10-20   20 Okt 2026 09.12 WIB
> Rincian (butir 1-6)
Data kesehatan     Aktif sejak 20 Okt 2026      [ Tarik persetujuan ]
  -> konfirmasi: "Semua catatan kesehatan akan dihapus permanen. Ketik HAPUS."
```

Tantangan (di grup atau `/home/challenges`):
```
TANTANGAN
+------------------------------------------+
| Lari 50 km Oktober        Grup Pagi Run  |
| 1-31 Okt - Jarak - Lari                  |
| [##########--------] 31,2 / 50 km        |
| 12 peserta - #3 dari 12                  |
| [ Keluar ]                               |
+------------------------------------------+
Buat tantangan (pemilik grup / admin klub):
Nama | Metrik (sesi/jarak/durasi) | Target | Olahraga (opsional) | Mulai | Selesai
```

Post dengan foto:
```
+------------------------------------------+
| @dina.lari - 2 jam lalu                  |
| Long run pagi                            |
| +---------+---------+                    |
| |  foto 1 |  foto 2 |  (maks 4, grid)    |
| +---------+---------+                    |
| Lari 21,1 km - 2 j 05 m                  |
| [Kudos 12] [Api] [Kuat] [Tepuk]          |
+------------------------------------------+
Form: teks + "Tambah foto" (jpeg/png/webp, maks 5 MB, maks 4)
```

## Perlu keputusan atau perhatian
- `app/api/onboarding/register/route.ts` (daftar klub dari `register-club-form.tsx`) juga menyimpan `terms_privacy`, tapi tidak ada di daftar validasi server A3. Saya ikut tambahkan di sana.
- Wilayah Vercel tidak tercatat di repo (`vercel.json` tanpa `regions`), jadi saya tulis Amerika Serikat sebagai wilayah bawaan. Mohon konfirmasi di dashboard Vercel (Settings > Functions > Region) atau beri tahu saya.
- `PRIVACY_VERSION` tetap dipakai untuk persetujuan data anggota (`member_data`/`guardian`) yang diisi klub; `CONSENT_VERSION` hanya untuk `terms_privacy`.
- Halaman langganan belum punya riwayat pembayaran. A8 butuh daftar riwayat baru (perpanjangan dan seat yang `paid`) supaya tautan kwitansi punya tempat.
- Anak yang sudah punya catatan kesehatan: data lama tidak dihapus otomatis, hanya disembunyikan dan dikunci. Bilang kalau ingin dihapus.
- `sharp` sudah terpasang sebagai dependensi Next, tapi bukan dependensi langsung. Saya tambahkan ke `package.json` dengan versi yang sama supaya build Vercel pasti memuatnya.
- Reaksi (B17) mengubah primary key `post_reactions` menjadi satu reaksi per orang per post dengan `kind`. Primary key itu sudah satu per orang, jadi cukup tambah kolom.

## Log fase
