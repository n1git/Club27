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

Fase 1 sudah terpenuhi oleh kode yang ada: `/signup/account` membuat `accounts` saja dan sesi `personal` di `/home`, `/home` punya form "Buat organisasi" memakai akun yang sama, handle = `accounts.username` (unik). Ditambah tautan dari `/signup`. Fase 2 belum mulai.

### Fase 2: catatan latihan (selesai, diterapkan ke hosted)

Migrasi 048: `current_account_id()` (akun aktif dan sesi belum dicabut, dari klaim `account_id`), `workout_logs` (olahraga = `club_types.code`, tanggal 2000..hari ini WIB, durasi 1..1440, jarak 1..1.000.000 m, catatan <= 2000, maksimal 10.000 baris per akun), `workout_goals` (target sesi per minggu 1..21). RLS: hanya pemilik akun. Halaman `/home/workouts` (ringkasan 4 minggu, target, form, riwayat). Tes: `supabase/tests/workout_logs_phase2.sql`.
Batas: halaman hanya untuk konteks `personal`; pengguna dengan satu klub langsung masuk ke klub itu dan belum punya jalan ke `/home/workouts`. Perlu diputuskan di fase 3 (pengalih konteks).

### Beranda gaya media sosial (selesai)

Login selalu membuka konteks `personal` (`/home`), apa pun peran akunnya. Menu: Beranda (`/home`: ringkasan latihan, daftar klub dan organisasi untuk masuk, tempat feed), Profil (`/profile`), Latihan (`/home/workouts`), Upgrade (`/home/upgrade`, buat organisasi dan langganan), Pengaturan (`/home/settings`, kata sandi), Keluar (tombol di header). Masuk ke klub lewat tombol "Masuk" di Beranda; kembali lewat "Akun saya" di header klub. Undangan yang baru diterima tetap langsung membuka klub tujuan (`resolveClubTarget`).
Diuji end to end lokal: daftar, menu, latihan, target, keluar, login ulang, pemilik organisasi tetap mendarat di Beranda, masuk klub dan kembali.

### Fase 3: teman dan feed (selesai, diterapkan ke hosted)

Migrasi 049: `friendships`, `blocks`, `posts` (teks atau cuplikan latihan, `visibility` hanya `friends`), `post_reactions`, `post_comments`, `reports`, view `social_people`, fungsi `request_friend` / `respond_friend` / `remove_friend` / `block_account` / `unblock_account` / `create_post` / `share_workout`. Pertemanan ditulis hanya lewat RPC; pencarian hanya username yang persis sama (tanpa daftar pengguna). Blokir menghapus pertemanan dan menyembunyikan konten dua arah. Batas harian: 50 postingan, 200 komentar, 50 laporan; 100 permintaan tertunda, 1.000 hubungan.
UI: Beranda (composer + feed, halaman berikutnya lewat `?sebelum=`), `/home/friends`, tombol Bagikan di Latihan. Tes: `supabase/tests/friends_feed_phase3.sql` dan e2e dua akun lokal (permintaan, terima, posting, suka, komentar, bagikan latihan, blokir, buka blokir).
Untuk publik nanti: perlu migrasi yang melonggarkan `posts.visibility`, kebijakan `posts_visible`, dan moderasi. Laporan hanya tersimpan; belum ada layar peninjauan untuk superadmin.

### Fase 4: gabung klub (selesai, diterapkan ke hosted)

Migrasi 050: `club_join_requests` (nama, tanggal lahir, telepon, pesan, versi privasi), `request_club_join` / `cancel_club_join` (akun pribadi, RPC) dan `decide_club_join` (hanya service role; izin `members.create` diperiksa di aksi server). Calon anggota memakai kode klub (`clubs.slug`) yang dibagikan admin; hanya usia 18+ (anak didaftarkan klub). Syarat klub: modul `member_portal` aktif dan langganan trial atau aktif. Persetujuan membuat `club_members` baru (admin memilih pelatih) atau menghubungkan ke anggota yang belum punya akun (disarankan dari pencarian nama dan tanggal lahir), lalu memakai `activate_member_account`. Permintaan ikut ekspor dan purge organisasi.
UI: `/home/join-club` (form dan riwayat permintaan), `/admin/join-requests` (kode klub, antrean, setujui atau tolak). Pelatih tidak melihat antrean (hanya `members.create`).
Tes: `supabase/tests/club_join_phase4.sql`, e2e lokal (anak ditolak, kode salah, antre, setujui, anggota masuk `/member`). Tes isolasi akun diberi pengecualian untuk `social_people` (hanya baris sendiri).

### Fase 5: grup dan event (selesai, diterapkan ke hosted)

Migrasi 051: `groups`, `group_members` (peran owner atau member, status invited atau active), `events`, `event_rsvps`; semua ditulis lewat RPC (`create_group`, `invite_to_group`, `respond_group_invite`, `leave_group`, `remove_group_member`, `delete_group`, `create_event`, `cancel_event`, `rsvp_event`). Grup privat: hanya pemilik yang mengundang, hanya teman yang bisa diundang; hanya anggota yang melihat anggota dan event; kuota event dijaga dengan kunci baris. `social_people` ikut menampilkan sesama anggota grup. Tipe laporan bertambah `group` dan `event`.
UI: `/home/groups` (undangan, daftar, buat), `/home/groups/[id]` (event dan RSVP, anggota, undang, keluar atau hapus, laporkan), kartu Event mendatang di Beranda.
Tes: `supabase/tests/groups_events_phase5.sql` dan e2e dua akun (buat, undang, terima, event, kuota, keluar, hapus).
Daftar hal yang perlu perhatian: `progress/social-free-attention.md`.

### Fase 6: moderasi, ekspor dan hapus akun (selesai, diterapkan ke hosted)

Migrasi 052: `reports.status` (open, dismissed, removed, suspended), `reviewed_at`, `reviewed_by`; pengguna hanya boleh mengisi `target_type`, `target_id`, `reason`. Layar `/superadmin/reports`: pratinjau konten, abaikan, hapus konten, nonaktifkan akun penulis (sesi dicabut), aktifkan kembali. Batas laju aplikasi untuk aksi sosial (`lib/auth/social-limit.ts`). Pengaturan akun pribadi: ekspor ZIP CSV (`/api/export/account`, kata sandi ulang, 3 per jam, diaudit) dan hapus akun (kata sandi dan kata HAPUS; ditolak bila masih terhubung ke klub atau organisasi).
Tes: `supabase/tests/report_review_phase6.sql`, e2e lokal ekspor dan hapus akun; lapisan data laporan diuji dengan data contoh.
Tinjauan hukum tidak bisa dikerjakan lewat kode; lihat `progress/social-free-attention.md`.

### Paket tindak lanjut (selesai, diterapkan ke hosted)

Migrasi 053: `accounts.social_banned_at` dan `username_changed_at`, blokir ikut mengeluarkan dari grup, `rotate_club_code()`. Penangguhan sosial untuk pemilik atau staf (tidak dikunci total), username sekali per 30 hari, ganti kode klub, angka di menu (permintaan teman, undangan grup, permintaan gabung), pemberitahuan klub nonaktif di Beranda, email laporan baru (`REPORT_NOTIFY_EMAIL`), formulir tidak ter-reset saat gagal. Diuji dengan e2e lokal termasuk login superadmin dengan TOTP dan semua aksi di layar laporan.
