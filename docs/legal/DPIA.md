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

## Penyedia dan transfer ke luar negeri

Supabase (Jepang), Vercel (Amerika Serikat), Resend (Amerika Serikat), Cloudflare Turnstile (Amerika Serikat), Midtrans (Indonesia). Daftar yang ditampilkan ke pengguna ada di `lib/consent.ts`. Penyedia baru wajib ditambahkan di sana dan menaikkan `CONSENT_VERSION`.

## Masa simpan

`audit_log` 5 tahun; akun pribadi tanpa login 3 tahun; data klub dapat dibaca satu tahun setelah langganan berakhir. `retention_candidates()` hanya mendaftar kandidat; penghapusan dilakukan manual setelah ditinjau.
