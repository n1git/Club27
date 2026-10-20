# legal-and-engagement

Bagian A: kepatuhan UU PDP. Bagian B: fitur kompetitif dan sosial. Bagian B baru dikerjakan setelah A selesai dan owner memberi OK.

## Status
Fase 0 disetujui (2026-10-20). Fase 1 selesai; migrasi 061 belum diterapkan ke hosted dan kode Fase 1 belum di-push (menunggu OK penerapan). A8 kwitansi ditunda owner ("pembayaran menyusul").

- [x] Fase 0: rencana
- [x] Fase 1: migrasi 061 dan kode A2-A7, A9
- [x] Fase 2: DPIA, rencana respons insiden, aturan A10 (kwitansi ditunda owner)
- [ ] Fase 3: migrasi 062, peringkat, tantangan, lencana, rekor, streak
- [ ] Fase 4: migrasi 063, foto post, reaksi, kartu bagikan

## Teks persetujuan (`lib/consent.ts`, `CONSENT_VERSION = "2026-10-20"`)

Label centang: "Saya berusia 18 tahun ke atas dan menyetujui Syarat & Ketentuan dan Kebijakan Privasi". Di bawahnya ada `<details>` "Lihat rincian persetujuan" yang memuat butir berikut.

1. Usia. Saya berusia 18 tahun ke atas. Anak di bawah 18 tahun hanya dapat didaftarkan oleh klub dengan persetujuan orang tua atau wali.
2. Penyedia infrastruktur dan transfer ke luar negeri. Data saya diproses oleh penyedia berikut, dan sebagian disimpan atau diproses di luar Indonesia:
   - Supabase: basis data dan penyimpanan berkas, Jepang (Tokyo, `ap-northeast-1`, dicek di project hosted);
   - Vercel: hosting aplikasi, Amerika Serikat (Washington, D.C., `iad1`, dikonfirmasi owner);
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

### Fase 0: jawaban owner (2026-10-20)
- Vercel: `iad1`, Washington, D.C.
- A8 kwitansi: ditunda sampai pembayaran (Midtrans production) berjalan. `receipt_no` tidak masuk migrasi 061.
- Usulan saya dipakai untuk poin lain: validasi juga di `app/api/onboarding/register/route.ts`; data kesehatan anak disembunyikan dan dikunci, tidak dihapus; `PRIVACY_VERSION` tetap untuk persetujuan data anggota.

### Fase 1 (selesai)
- Migrasi `20250101000061_consent_compliance.sql`:
  - `consents.kind` ditambah `health_data`, kolom `revoked_at`, indeks per akun;
  - trigger `consents_guard`:
    - delete ditolak `CN001`, kecuali saat purge; purge mengubah delete menjadi pelepasan: `club_id`/`organization_id`/`guardian_name` dikosongkan dan `revoked_at` diisi, baris tetap ada;
    - update hanya boleh mengisi `revoked_at` sekali atau mengosongkan `guardian_name` (`CN002`);
  - `has_health_consent`; `enforce_body_measurement` menolak tanpa persetujuan aktif (`BM003`);
  - `withdraw_health_consent(account)` (service role): tarik persetujuan dan hapus semua `body_measurements` dalam satu transaksi;
  - `retention_candidates()` (service role): `audit_log` > 5 tahun (jumlah), akun pribadi tanpa klub/organisasi yang tidak login > 3 tahun. Tidak menghapus apa pun dan tanpa cron.
- Kode:
  - persetujuan:
    - `lib/consent.ts` (`CONSENT_VERSION` 2026-10-20, label, butir, teks persetujuan kesehatan);
    - `components/shared/consent-checkbox.tsx` dan `consent-details.tsx`;
    - `components/landing/legal-contact.tsx`: `LegalContact` dipisah supaya bisa dipakai di form klien, `legal-page.tsx` mengekspornya ulang;
  - keempat form memakai `ConsentCheckbox`;
  - validasi server memakai `CONSENT_REQUIRED_ERROR` dan menyimpan `CONSENT_VERSION` di `app/api/accounts/register`, `app/api/onboarding/register`, `lib/actions/organization.ts` dan `lib/actions/invitations.ts`;
  - `/home/settings` mendapat kartu "Persetujuan saya" (`components/shared/my-consents-card.tsx`, `lib/data/consents.ts`): versi, tanggal WIB, rincian, status kesehatan, tombol tarik dengan konfirmasi HAPUS;
  - `/home/health` menampilkan layar persetujuan sebelum dipakai; `lib/actions/health.ts` menolak tanpa persetujuan dan untuk anak, plus `giveHealthConsent` dan `withdrawHealthConsent`;
  - pembatasan anak:
    - `lib/auth/social-access.ts`: `isMinorAccount`, `socialRestriction`; `isSocialBanned` dan `socialBlocked` sekarang juga menahan anak dengan pesan sendiri, jadi semua halaman dan aksi sosial yang sudah dijaga ikut tertahan;
    - `personal-shell.tsx` menyembunyikan Teman, Grup, Kesehatan untuk anak dan menampilkan pemberitahuan;
    - `app/member/layout.tsx` dan `/member/leaderboard` menyembunyikan peringkat;
  - `lib/actions/account-delete.ts`: persetujuan tidak lagi dihapus; setelah akun terhapus, `revoked_at` diisi dan `guardian_name` dikosongkan;
  - `/privacy`: "foto postingan" dan kalimat rincian persetujuan; tidak ada nama penyedia;
  - `LEGAL_UPDATED` 2026-10-20;
  - ekspor akun memuat `revoked_at`.
- Tes SQL (database lokal baru 001-061, Postgres 17), tiap berkas di salinan baru dengan `ON_ERROR_STOP`, semua kode keluar 0:
  - 15 berkas: `accounts_phase1`, `club_join_phase4`, `consent_phase1` (baru), `deletion_phase6`, `friends_feed_phase3`, `groups_events_phase5`, `health_phase1`, `invitations_phase5`, `leaderboards_phase7`, `organization_members_phase2`, `permissions_phase3`, `report_review_phase6`, `seats_phase4`, `workout_logs_phase2`;
  - `health_phase1` dan `accounts_phase1` kini menyisipkan persetujuan kesehatan sebelum data kesehatan;
  - `health_phase1` menerima `BM003` untuk insert tanpa token, karena trigger berjalan sebelum cek NOT NULL.
- E2E lokal (`/tmp/hb/e2e/consent.cjs`, kode keluar 0, 29 pemeriksaan):
  - keempat form menampilkan label dan rincian (penyedia, 3 x 24 jam);
  - kiriman tanpa centang ditahan browser dan, bila `required` dibuang, ditolak server dengan pesan Indonesia;
  - ketiga jalur daftar menyimpan `CONSENT_VERSION`;
  - `/privacy` tanpa nama penyedia;
  - kesehatan: layar persetujuan, insert langsung lewat PostgREST tanpa persetujuan ditolak `BM003`, simpan setelah setuju, tarik persetujuan mengosongkan baris, baris persetujuan tetap ada dengan `revoked_at`, lalu persetujuan diminta lagi;
  - anak (anggota klub lahir 2012): menu Teman/Grup/Kesehatan hilang, pemberitahuan tampil, ketiga halaman not-found, Latihan tetap ada;
  - hapus akun menyisakan dua baris persetujuan dengan `revoked_at`.
- Hosted:
  - `list_migrations` berakhir di 058: migrasi 059 dan 060 dari sesi rebrand belum diterapkan;
  - uji 061 dalam transaksi yang di-rollback: setiap bagian lulus bila dijalankan terpisah dengan `statement_timeout`, dan tidak ada sisa;
  - menjalankan semuanya sekaligus membuat alat MCP timeout di luar database (database bersih, tidak ada transaksi menggantung), diduga konfirmasi pernyataan destruktif `update` + `delete` yang tidak muncul.
- Pemeriksaan: `npx next typegen && npx tsc --noEmit` lulus.
- Blocker: kode Fase 1 membaca `consents.revoked_at` dan `health_data`. Push sebelum 061 diterapkan akan merusak Pengaturan, Kesehatan, dan hapus akun di production. Kode ditahan sampai OK penerapan.

### Fase 2 (selesai, kecuali kwitansi)
- `docs/legal/DPIA.md`:
  - data anak, data kesehatan, foto postingan (rencana Fase 4);
  - untuk tiap data: tujuan, dasar, akses, risiko, pengendalian, sisa risiko;
  - penyedia dan masa simpan.
- `docs/legal/INCIDENT_RESPONSE.md`:
  - penanggung jawab (nama koordinator perlu diisi owner);
  - langkah dengan jam: catat, tahan (cabut sesi lewat `accounts.sessions_valid_after`, nonaktifkan akun/klub), rotasi kunci (JWT Supabase, service role, superadmin, cron, Midtrans, Resend, Turnstile, rahasia titik check-in), selidiki, beri tahu dalam 3 x 24 jam, pulihkan, tutup;
  - templat pemberitahuan ke pengguna dan ke lembaga, dan log insiden.
- `CLAUDE.md` (Aturan teknis): aturan persetujuan dan aturan A10 (fitur publik tanpa anak dan post privat sebagai bawaan, agregat minimal 10 akun, data impor pihak ketiga hanya untuk pemilik, persetujuan AI terpisah).
- Kwitansi (A8) ditunda owner sampai pembayaran berjalan.
- Pemeriksaan: `npx next typegen && npx tsc --noEmit` lulus.
- Blocker: sama dengan Fase 1 (kode menunggu penerapan 061).
