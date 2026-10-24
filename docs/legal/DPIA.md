# Penilaian dampak pelindungan data (DPIA)

Dasar: UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 34 (pemrosesan berisiko tinggi). Pengendali untuk akun pribadi dan langganan: N-1Labs (Kota Semarang). Untuk data anggota klub, klub adalah pengendali dan N-1Labs pemroses.

Dinilai: 2026-10-20, versi persetujuan `2026-10-20` (`lib/consent.ts`). Tinjau ulang setiap ada jenis data baru, penyedia baru, atau fitur publik.

## 1. Data anak (anggota di bawah 18 tahun)

| Aspek | Isi |
|---|---|
| Data | nama, tanggal lahir, alamat, kontak dan nama orang tua/wali, catatan, jadwal, kehadiran, check-in, tagihan (`club_members`, `consents.kind = 'guardian'`) |
| Tujuan | klub mengelola anggota dan kegiatan |
| Dasar | persetujuan orang tua/wali yang dicatat klub (`member_consent_fields`, `consents.kind = 'guardian'`) |
| Akses | staf klub sesuai izin; anak hanya membaca datanya sendiri di `/member` |
| Risiko | anak berinteraksi dengan orang asing; profil anak terlihat oleh akun lain; data dipakai di luar klub |
| Pengendalian | anak tidak bisa mendaftar sendiri (centang 18+ dan validasi usia `club_join_requests`); akun yang tertaut ke profil anggota di bawah 18 tahun kehilangan teman, feed, grup, event, peringkat, tantangan, foto, dan data kesehatan (`lib/auth/social-access.ts`); anonimisasi anggota mengosongkan `guardian_name` |
| Sisa risiko | pembatasan sosial anak ditegakkan di aplikasi, belum di RLS/RPC; tanggal lahir yang salah dari klub membuat pembatasan tidak berlaku; anak yang berbohong saat daftar akun pribadi tidak terdeteksi |

## 2. Data kesehatan (tinggi dan berat badan)

| Aspek | Isi |
|---|---|
| Data | `body_measurements` (tanggal, tinggi, berat); IMT dihitung, tidak disimpan |
| Tujuan | pencatatan pribadi pemilik akun |
| Dasar | persetujuan eksplisit terpisah (`consents.kind = 'health_data'`), dapat ditarik |
| Akses | hanya pemilik (RLS `current_account_id()`); tidak ada akses klub, pelatih, teman, grup, feed, peringkat |
| Risiko | data spesifik bocor atau terbaca pihak lain; dipakai untuk profil atau iklan |
| Pengendalian | trigger menolak penyimpanan tanpa persetujuan aktif (`BM003`); penarikan menghapus semua baris dalam satu transaksi (`withdraw_health_consent`); nilai tidak ditulis ke `audit_log` atau log server; anak tidak bisa memakai fitur ini; ekspor akun memuat `kesehatan.csv` |
| Sisa risiko | data anak yang sudah tercatat sebelum pembatasan tetap tersimpan (disembunyikan dan dikunci); cadangan basis data penyedia menyimpan salinan sampai masa retensi cadangan berakhir |

## 3. Foto postingan (direncanakan, Fase 4)

| Aspek | Isi |
|---|---|
| Data | foto yang diunggah ke postingan, bucket privat `post-media` |
| Tujuan | berbagi latihan dengan teman |
| Dasar | persetujuan S&K dan Kebijakan Privasi; pengguna memilih mengunggah |
| Akses | hanya akun yang lolos RLS `posts_visible` (teman); URL bertanda tangan berumur pendek dibuat server |
| Risiko | lokasi dan perangkat terbaca dari EXIF; wajah orang lain atau anak ikut terunggah; konten tidak pantas |
| Pengendalian | encode ulang ke webp maks 1600 px dengan `sharp` (EXIF dan lokasi terbuang); maks 4 foto, 5 MB, jpeg/png/webp; postingan disembunyikan otomatis pada 3 laporan terbuka; anak tidak bisa mengunggah; hapus akun menghapus objek storage |
| Sisa risiko | foto orang lain tanpa izin; tidak ada deteksi konten otomatis |

## 4. Foto profil, notifikasi, cerita, dan pesan langsung

| Data | Tujuan | Akses | Masa simpan | Pengendalian |
|---|---|---|---|---|
| Foto profil (`accounts.avatar_path`, bucket privat `post-media`) | menampilkan akun ke teman | teman yang lolos `social_people`; URL bertanda tangan | sampai diganti, dihapus, atau akun dihapus | encode ulang ke webp 512 px persegi (EXIF terbuang); maks 5 MB; anak tidak bisa mengunggah |
| Notifikasi (`notifications`) | memberi tahu reaksi, komentar, permintaan dan penerimaan pertemanan, undangan grup | hanya penerima (RLS); tulis hanya lewat trigger `security definer`; tidak ke diri sendiri, tidak lintas blokir, tidak ke akun anak atau akun yang dibatasi | 90 hari (`purge_social_expired`, cron harian) | pembersihan otomatis saat blokir dan saat reaksi atau permintaan dibatalkan |
| Cerita (`stories`, `story_views`, foto di bucket privat) | berbagi foto singkat dengan teman | penulis dan teman (`can_see_story`), tidak lintas blokir; daftar pelihat hanya untuk penulis | 24 jam; lewat itu tidak terlihat oleh siapa pun dan cron menghapus baris dan file | maks 10 cerita aktif; hanya foto; anak tidak bisa membuat atau melihat |
| Pesan langsung (`dm_threads`, `dm_messages`, foto di bucket privat) | percakapan 1 lawan 1 antar teman | hanya dua peserta (RLS); kirim hanya lewat `send_message` yang memeriksa pertemanan, blokir, dan pembatasan akun | 365 hari, lalu dihapus cron; hapus akun menghapus semua pesan dan file percakapannya | pesan bisa ditarik (isi dan foto dihapus); percakapan menjadi baca-saja saat pertemanan berakhir atau ada blokir; pesan bisa dilaporkan; batas 1.000 pesan per hari |
| Sisa risiko | isi pesan tidak dienkripsi ujung ke ujung dan dapat dibaca superadmin lewat laporan; pesan yang sudah dibaca penerima tetap bisa disalin atau ditangkap layar; cadangan penyedia menyimpan salinan sampai masa retensi cadangan berakhir | | | |

## Penyedia dan transfer ke luar negeri

Supabase (Jepang), Vercel (Amerika Serikat), Resend (Amerika Serikat), Cloudflare Turnstile (Amerika Serikat), Midtrans (Indonesia). Daftar yang ditampilkan ke pengguna ada di `lib/consent.ts`. Penyedia baru wajib ditambahkan di sana dan menaikkan `CONSENT_VERSION`.

## Masa simpan

`audit_log` 5 tahun; akun pribadi tanpa login 3 tahun; data klub dapat dibaca satu tahun setelah langganan berakhir. `retention_candidates()` hanya mendaftar kandidat; penghapusan dilakukan manual setelah ditinjau.
