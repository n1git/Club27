# social-free

Tujuan: satu akun bisa dipakai tanpa organisasi untuk fitur sosial; langganan hanya untuk fitur bisnis (organisasi dibuat di atas akun yang sama).

Keputusan: satu `accounts` untuk semua; fitur sosial = profil + catatan latihan, teman/feed/aktivitas, gabung klub sebagai anggota, grup/komunitas/event.

## Anak dan data klub

Anak di klub renang adalah anggota (`club_members`) yang dikelola klub, tanpa peran orang tua. Data anggota klub tidak pernah tampil di fitur sosial. Akun sosial hanya untuk orang yang mendaftar sendiri; pendaftar memastikan usia minimal saat daftar. Gabung klub (fase 4) membuat anggota di klub, tanpa membuka profil sosialnya ke klub kecuali pengguna memilih.

## Fase

1. Akun pribadi: daftar hanya membuat `accounts` + `social_profiles` (handle unik, nama, bio, visibilitas). Sesi tanpa `club_id` (konteks personal), RLS berbasis `account_id`. Tombol "Mulai bisnis" memanggil `register_organization` dengan akun yang sama. Verifikasi email wajib untuk akun pribadi.
2. Catatan latihan: `workout_logs`, target pribadi, ringkasan.
3. Teman dan feed: `friendships`, `posts`, `reactions`, `comments`, blokir, laporkan, visibilitas (privat/teman/publik).
4. Gabung klub: `club_join_requests`; admin klub menyetujui, lalu membuat `club_members` + profil `member` yang sudah ada. Gate langganan klub tetap berlaku.
5. Grup dan event: `groups`, `group_members`, `events`, `event_rsvps`.
6. Keamanan dan privasi: rate limit, moderasi, ekspor dan hapus akun, tinjauan hukum.

## Keputusan (2026-10-17)

- Tetap memakai auth kustom yang ada (JWT `app_session`, konteks `personal`).
- Email hanya diminta saat daftar, tanpa email verifikasi untuk akun pribadi. Satu email satu akun: `accounts.email` unik, huruf kecil, dan dipangkas di zod.
- Feed hanya teman dulu; publik menyusul lewat kolom visibilitas.

## Status

Fase 1 sudah terpenuhi oleh kode yang ada: `/daftar/akun` membuat `accounts` saja dan sesi `personal` di `/akun`, `/akun` punya form "Buat organisasi" memakai akun yang sama, handle = `accounts.username` (unik). Ditambah tautan dari `/daftar`. Fase 2 belum mulai.

### Fase 2: catatan latihan (selesai, diterapkan ke hosted)

Migrasi 048: `current_account_id()` (akun aktif dan sesi belum dicabut, dari klaim `account_id`), `workout_logs` (olahraga = `club_types.code`, tanggal 2000..hari ini WIB, durasi 1..1440, jarak 1..1.000.000 m, catatan <= 2000, maksimal 10.000 baris per akun), `workout_goals` (target sesi per minggu 1..21). RLS: hanya pemilik akun. Halaman `/akun/latihan` (ringkasan 4 minggu, target, form, riwayat). Tes: `supabase/tests/workout_logs_phase2.sql`.
Batas: halaman hanya untuk konteks `personal`; pengguna dengan satu klub langsung masuk ke klub itu dan belum punya jalan ke `/akun/latihan`. Perlu diputuskan di fase 3 (pengalih konteks).

### Beranda gaya media sosial (selesai)

Login selalu membuka konteks `personal` (`/akun`), apa pun peran akunnya. Menu: Beranda (`/akun`: ringkasan latihan, daftar klub dan organisasi untuk masuk, tempat feed), Profil (`/akun/profil`), Latihan (`/akun/latihan`), Upgrade (`/akun/upgrade`, buat organisasi dan langganan), Pengaturan (`/akun/pengaturan`, kata sandi), Keluar (tombol di header). Masuk ke klub lewat tombol "Masuk" di Beranda; kembali lewat "Akun saya" di header klub. Undangan yang baru diterima tetap langsung membuka klub tujuan (`resolveClubTarget`).
Diuji end to end lokal: daftar, menu, latihan, target, keluar, login ulang, pemilik organisasi tetap mendarat di Beranda, masuk klub dan kembali.

### Fase 3: teman dan feed (selesai, diterapkan ke hosted)

Migrasi 049: `friendships`, `blocks`, `posts` (teks atau cuplikan latihan, `visibility` hanya `friends`), `post_reactions`, `post_comments`, `reports`, view `social_people`, fungsi `request_friend` / `respond_friend` / `remove_friend` / `block_account` / `unblock_account` / `create_post` / `share_workout`. Pertemanan ditulis hanya lewat RPC; pencarian hanya username yang persis sama (tanpa daftar pengguna). Blokir menghapus pertemanan dan menyembunyikan konten dua arah. Batas harian: 50 postingan, 200 komentar, 50 laporan; 100 permintaan tertunda, 1.000 hubungan.
UI: Beranda (composer + feed, halaman berikutnya lewat `?sebelum=`), `/akun/teman`, tombol Bagikan di Latihan. Tes: `supabase/tests/friends_feed_phase3.sql` dan e2e dua akun lokal (permintaan, terima, posting, suka, komentar, bagikan latihan, blokir, buka blokir).
Untuk publik nanti: perlu migrasi yang melonggarkan `posts.visibility`, kebijakan `posts_visible`, dan moderasi. Laporan hanya tersimpan; belum ada layar peninjauan untuk superadmin.
