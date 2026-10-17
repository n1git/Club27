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

## Status

Belum mulai. Menunggu OK untuk fase 1.
