# Perlu perhatian (fitur sosial dan akun pribadi)

Daftar ini dikumpulkan dari fase 1 sampai 5 dan diperbarui tiap fase. Tandai selesai dengan `[x]`.

## Sebelum fitur dibuka untuk umum

- [ ] `/privasi` dan `/syarat` masih draf. Tinjauan ahli hukum wajib karena situs menyimpan data anggota klub, dan sekarang juga profil, postingan, teman, dan lokasi acara.
- [ ] Laporan (`reports`: postingan, komentar, grup, event) hanya tersimpan. Belum ada layar peninjauan di portal superadmin dan belum ada yang ditugaskan membacanya.
- [ ] Belum ada moderasi lanjutan: tidak ada penangguhan akun karena laporan, tidak ada penyembunyian konten otomatis.
- [ ] Vercel Authentication masih aktif, situs belum publik.
- [ ] `EMAIL_API_KEY` belum diisi, sehingga email undangan dan reset sandi tidak terkirim (tautannya ditampilkan di layar).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` dan `SUPABASE_JWT_SECRET` harus diisi manual di Vercel. Tanpanya pendaftaran dan login gagal.
- [ ] `npm run seed:superadmin` belum dijalankan (belum ada superadmin).

## Keputusan produk yang masih terbuka

- [ ] Username dibuat otomatis dari nama atau email saat daftar. Pengguna belum bisa mengubahnya, padahal username dipakai untuk dicari teman.
- [ ] Alias email (`nama+1@gmail.com`) dianggap email berbeda karena tidak ada verifikasi email.
- [ ] Feed publik: perlu migrasi yang melonggarkan `posts.visibility`, kebijakan `posts_visible`, dan moderasi (fase scale up).
- [ ] Kode klub = `clubs.slug` (misalnya `klub-e-14a3b5`). Tidak bisa diganti atau diputar. Siapa pun yang tahu kodenya bisa mengirim permintaan gabung (maksimal 200 tertunda per klub, 5 per akun).
- [ ] Pemohon gabung klub tidak diberi tahu saat disetujui atau ditolak. Statusnya tampil di `/akun/klub`, dan klub baru muncul di Beranda.
- [ ] Gabung klub hanya untuk usia 18+. Anak didaftarkan oleh klub (tanpa peran orang tua).
- [ ] Pelatih tidak melihat antrean gabung klub (hanya yang punya izin `members.create`).
- [ ] Grup: hanya pemilik yang bisa mengundang, hanya teman yang bisa diundang. Tidak ada postingan di dalam grup. Event hanya ada di dalam grup.
- [ ] Memblokir seseorang tidak mengeluarkannya dari grup yang sama. Nama anggota yang diblokir tetap terlihat di daftar anggota grup bersama.
- [ ] Event tidak memberi pengingat atau notifikasi apa pun (belum ada kanal notifikasi).
- [ ] Pengguna tidak diberi tahu (notifikasi) untuk permintaan teman, undangan grup, suka, komentar. Semua dilihat saat membuka halaman.

## Perilaku yang berubah

- [ ] Login selalu membuka Beranda akun pribadi. Tautan dalam yang butuh login (misalnya `/admin/...`) berakhir di Beranda. Undangan yang baru diterima tetap langsung membuka klub tujuan.
- [ ] Akun yang klubnya dinonaktifkan sekarang bisa login ke Beranda (sebelumnya ditolak dengan pesan).
- [ ] Formulir yang gagal tersimpan ter-reset (termasuk kotak persetujuan privasi). Ini perilaku formulir aplikasi yang sudah ada.

## Teknis

- [ ] Tidak ada rollback otomatis untuk migrasi 045 sampai 051 (pulihkan dari cadangan).
- [ ] Belum direname: `instructor_id`, `subscription_renewals.users`, `audit_log.at`, `profiles.owner_id`.
- [ ] Gambar promo di storage tidak ikut diekspor dan tidak ikut dihapus saat purge organisasi.
- [ ] Data sosial (teman, postingan, grup, event, catatan latihan) belum ikut ekspor atau hapus akun pribadi. Akun pribadi belum punya ekspor data dan hapus akun (rencana fase 6).
- [ ] Batas harian (50 postingan, 200 komentar, 50 laporan) dan batas jumlah (10.000 catatan latihan, 1.000 hubungan teman, 20 grup dibuat, 50 grup diikuti, 200 anggota per grup, 30 event mendatang per grup) adalah angka awal saya, belum diuji dengan pemakaian nyata.
- [ ] Data sosial yang dibaca layar hanya dibatasi halaman dan batas baris tetap (20 postingan per halaman, 200 grup, 5.000 reaksi). Belum ada pencarian atau indeks tambahan untuk skala besar.
