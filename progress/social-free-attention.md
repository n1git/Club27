# Perlu perhatian (fitur sosial dan akun pribadi)

Daftar ini dikumpulkan dari fase 1 sampai 5 dan diperbarui tiap fase. Tandai selesai dengan `[x]`.

## Sebelum fitur dibuka untuk umum

- [ ] `/privasi` dan `/syarat` masih draf. Tinjauan ahli hukum wajib karena situs menyimpan data anggota klub, dan sekarang juga profil, postingan, teman, dan lokasi acara.
- [ ] Tugaskan satu orang yang membuka `/superadmin/laporan` tiap hari. Layar dan semua tombol aksinya sudah diuji lewat browser (login TOTP lokal). Notifikasi email laporan baru aktif bila `REPORT_NOTIFY_EMAIL` diisi bersama `EMAIL_API_KEY`; isinya hanya tipe laporan dan tautan, tanpa konten.
- [x] Menonaktifkan penulis dari laporan: akun biasa dinonaktifkan penuh; pemilik atau staf klub hanya kehilangan fitur sosial (`accounts.social_banned_at`), akses klubnya tetap jalan. Penegakannya di aplikasi (aksi dan halaman sosial), bukan di RLS database.
- [ ] Mengaktifkan kembali hanya bisa dari daftar "Terakhir ditinjau" (20 terakhir); setelah itu hanya lewat SQL.
- [ ] Moderasi lanjutan belum ada: tidak ada penyembunyian konten otomatis dan tidak ada banding.
- [ ] Vercel Authentication masih aktif, situs belum publik.
- [ ] `EMAIL_API_KEY` belum diisi, sehingga email undangan dan reset sandi tidak terkirim (tautannya ditampilkan di layar). Isi juga `REPORT_NOTIFY_EMAIL` (alamat yang menerima notifikasi laporan baru).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` dan `SUPABASE_JWT_SECRET` harus diisi manual di Vercel. Tanpanya pendaftaran dan login gagal.
- [ ] `npm run seed:superadmin` belum dijalankan (belum ada superadmin).

## Keputusan produk yang masih terbuka

- [x] Username dibuat otomatis dari nama atau email saat daftar. Koreksi dari catatan sebelumnya: username sudah bisa diubah di Profil. Sekarang dibatasi sekali per 30 hari. Username otomatis masih bisa membocorkan bagian depan email; pengguna perlu tahu bisa menggantinya.
- [ ] Alias email (`nama+1@gmail.com`) dianggap email berbeda karena tidak ada verifikasi email.
- [ ] Feed publik: perlu migrasi yang melonggarkan `posts.visibility`, kebijakan `posts_visible`, dan moderasi (fase scale up).
- [x] Kode klub = `clubs.slug` (misalnya `klub-e-14a3b5`). Admin dengan izin `club.settings` sekarang bisa menggantinya di `/admin/permintaan-gabung`. Siapa pun yang tahu kodenya tetap bisa mengirim permintaan gabung (maksimal 200 tertunda per klub, 5 per akun). Kode klub juga tampil di URL atau log lain yang memakai slug.
- [ ] Pemohon gabung klub tidak diberi tahu saat disetujui atau ditolak. Statusnya tampil di `/akun/klub`, dan klub baru muncul di Beranda.
- [ ] Gabung klub hanya untuk usia 18+. Anak didaftarkan oleh klub (tanpa peran orang tua).
- [ ] Pelatih tidak melihat antrean gabung klub (hanya yang punya izin `members.create`).
- [ ] Grup: hanya pemilik yang bisa mengundang, hanya teman yang bisa diundang. Tidak ada postingan di dalam grup. Event hanya ada di dalam grup.
- [x] Memblokir sekarang mengeluarkan salah satu pihak dari grup milik pihak lain (anggota keluar dari grup pemilik yang diblokir, atau pemilik menghapus anggota yang diblokir). Dua anggota biasa dalam grup yang sama masih sekelompok walau saling blokir; nama yang diblokir tetap terlihat di daftar anggota grup bersama.
- [ ] Notifikasi baru berupa angka di menu untuk permintaan teman masuk, undangan grup, dan permintaan gabung klub (admin). Belum ada notifikasi untuk suka, komentar, hasil permintaan gabung, atau pengingat event, dan belum ada email atau push.

## Perilaku yang berubah

- [ ] Login selalu membuka Beranda akun pribadi. Tautan dalam yang butuh login (misalnya `/admin/...`) berakhir di Beranda. Undangan yang baru diterima tetap langsung membuka klub tujuan.
- [x] Akun yang klubnya dinonaktifkan sekarang bisa login ke Beranda (sebelumnya ditolak dengan pesan). Beranda menampilkan pemberitahuan klub mana yang nonaktif.
- [x] Formulir yang gagal tersimpan tidak lagi ter-reset (`ActionForm`); formulir yang sukses tetap dikosongkan. Perubahan ini berlaku di seluruh aplikasi.

## Teknis

- [ ] Tidak ada rollback otomatis untuk migrasi 045 sampai 052 (pulihkan dari cadangan).
- [ ] Belum direname: `instructor_id`, `subscription_renewals.users`, `audit_log.at`, `profiles.owner_id`.
- [ ] Gambar promo di storage tidak ikut diekspor dan tidak ikut dihapus saat purge organisasi.
- [ ] Hapus akun pribadi ditolak bila akun masih terhubung ke klub (anggota, staf) atau organisasi. Anggota klub harus dihapus atau dianonimkan oleh klubnya dulu; pemilik harus menghapus organisasinya (masa pemulihan 30 hari) lebih dulu. Akun pribadi murni langsung terhapus permanen beserta data sosialnya.
- [ ] Ekspor data akun tidak memuat data klub tempat Anda menjadi anggota (dikelola klub).
- [ ] Batas laju aplikasi untuk aksi sosial: 30 postingan, 60 komentar, 20 laporan, 30 bagikan latihan, 10 grup, 60 undangan, 20 event, 60 catatan latihan per jam per akun. Angka awal, belum diuji dengan pemakaian nyata.
- [ ] Batas harian (50 postingan, 200 komentar, 50 laporan) dan batas jumlah (10.000 catatan latihan, 1.000 hubungan teman, 20 grup dibuat, 50 grup diikuti, 200 anggota per grup, 30 event mendatang per grup) adalah angka awal saya, belum diuji dengan pemakaian nyata.
- [ ] Data sosial yang dibaca layar hanya dibatasi halaman dan batas baris tetap (20 postingan per halaman, 200 grup, 5.000 reaksi). Belum ada pencarian atau indeks tambahan untuk skala besar.
- [x] CSP sudah membatasi script (nonce dan `strict-dynamic` di `proxy.ts`); catatan tim lama yang menyebut sebaliknya sudah tidak berlaku.
- [ ] Belum dikerjakan (opsional): pintasan "Buka klub terakhir" untuk pemilik klub di Beranda.
- [ ] Ambil cadangan database hosted sebelum migrasi berikutnya (saya tidak bisa mengambilnya dari sini).
