# health-tracking

Pelacakan kesehatan pribadi di akun personal: tinggi dan berat badan per tanggal, riwayat, dan IMT.

## Status
Fase 0 disetujui owner (2026-10-19, "okeee gas"; usulan saya dipakai: tanggal ganda ditolak, `health` dikecualikan dari blokir sosial, ikon `visits`, `PRIVACY_VERSION` tidak diubah). Semua fase selesai. Migrasi 058 diterapkan ke hosted 2026-10-19 atas OK owner ("terapkan"), lalu Fase 3 di-push.

- [x] Fase 0: rencana
- [x] Fase 1: migrasi 058, tes SQL, uji begin/rollback di hosted
- [x] Fase 2: data, aksi, validasi, halaman, komponen, menu
- [x] Fase 3: ekspor akun, kebijakan privasi, `LEGAL_UPDATED`

## Cara tiap peran sampai ke `/home/health`

`/home/*` hanya untuk sesi `personal` (`canAccessPath` di `lib/auth/roles.ts`, `requireRole("personal")` di `app/home/layout.tsx`). Semua orang punya baris `accounts`, jadi semua peran punya data kesehatan sendiri.

- Akun personal: login selalu membuka sesi `personal` di `/home`. Dari situ buka menu "Kesehatan".
- Pemilik dan staf (termasuk pelatih): login juga membuka `/home` lebih dulu. Dari `/admin` atau `/coach`, tombol "Akun saya" (`PersonalSwitch`, `switchContext` dengan key `personal`) kembali ke `/home`, lalu ke menu "Kesehatan".
- Anggota klub: sama, lewat "Akun saya" di `/member` (`app/member/layout.tsx` memakai `personalSwitch`).
- Sesi klub tidak bisa membuka `/home/health`; proxy mengalihkannya. JWT sesi klub juga membawa `account_id`, jadi lewat PostgREST pemilik sesi hanya bisa membaca baris miliknya sendiri, sama seperti `workout_logs`.

## Rencana per fase

### Fase 1: database (`20250101000058_body_measurements.sql`)
- Tabel `body_measurements`:
  - `id uuid` pk;
  - `account_id uuid not null default current_account_id() references accounts(id) on delete cascade`;
  - `measured_on date not null check (measured_on >= date '1900-01-01')`;
  - `height_cm numeric(4,1) check (height_cm between 50 and 250)`;
  - `weight_kg numeric(4,1) check (weight_kg between 20 and 300)`;
  - `created_at timestamptz not null default now()`;
  - `check (height_cm is not null or weight_kg is not null)`;
  - `unique (account_id, measured_on)`. Indeks unik ini sekaligus melayani urutan riwayat, jadi tidak perlu indeks tambahan.
- Trigger `enforce_body_measurement` (before insert or update):
  - `BM002` "Tanggal pengukuran tidak boleh di masa depan" (WIB);
  - `BM001` "Batas 10.000 catatan kesehatan tercapai" saat insert.
  - Fungsinya `security definer`, `set search_path = public`, `revoke execute ... from public, anon, authenticated`.
- RLS dan grant:
  - `revoke all ... from anon, authenticated`;
  - `grant select, insert, update, delete ... to authenticated`;
  - policy `body_measurements_own` for all: `using`/`with check (account_id = (select current_account_id()))`.
- Tidak ada `club_id` dan tidak ada view, fungsi peringkat, feed, atau `share_workout` yang membaca tabel ini. Tidak dicatat ke `audit_log`.
- `supabase/tests/accounts_phase1.sql`:
  - tabel baru otomatis masuk loop isolasi (`iso_objects`, tabel ber-RLS);
  - tambahkan satu baris milik akun pemilik klub sebelum loop, supaya loop benar-benar membuktikan konteks personal lain membaca 0 baris;
  - tambahkan asersi bahwa sesi pemilik/admin klub (`ctx` org, `club_id` klub yang sama) tidak membaca baris anggota klubnya.
- `supabase/tests/health_phase1.sql`, berpola `workout_logs_phase2.sql`:
  - tambah, ubah, dan hapus milik sendiri;
  - akun B tidak membaca, mengubah, atau menghapus baris A;
  - tidak bisa insert dengan `account_id` milik orang lain;
  - `BM002` untuk tanggal besok;
  - CHECK untuk 49,9/250,1 cm dan 19,9/300,1 kg, serta keduanya kosong;
  - unique per tanggal;
  - `BM001` lewat 10.000 baris;
  - token lama setelah `sessions_valid_after` membaca 0 baris;
  - `anon` ditolak;
  - hapus akun mengosongkan baris (cascade).
- `seats_phase4.sql` tidak terpengaruh (tanpa `club_id`). Saya akan memastikannya dengan menjalankan seluruh rangkaian tes di database lokal yang baru dibangun.
- Hosted: dijalankan hanya di dalam `begin; ... rollback;` lewat `execute_sql`, lalu dicek bahwa tabelnya tidak ada. Tidak di-`apply_migration` sampai Anda minta.

### Fase 2: aplikasi
- `lib/validations/limits.ts`: `HEIGHT_MIN_CM = 50`, `HEIGHT_MAX_CM = 250`, `WEIGHT_MIN_KG = 20`, `WEIGHT_MAX_KG = 300` (sama dengan CHECK).
- `lib/validations/health.ts`: skema zod `measuredOn` (format tanggal, bukan masa depan menurut WIB lewat `getJakartaDateString`), `heightCm` dan `weightKg` opsional, maksimal 1 desimal, minimal satu terisi. Pesan dalam bahasa Indonesia.
- `lib/actions/health.ts`: `addMeasurement`, `updateMeasurement`, `deleteMeasurement`.
  - Pakai `requireActionRole("personal")`, `socialLimited(account, "health", 60)` dan `revalidatePath("/home/health")`.
  - Galat dipetakan: `BM001`/`BM002` memakai pesannya; `23505` jadi "Sudah ada catatan untuk tanggal ini. Ubah catatan tersebut."; `23514` jadi pesan batas angka.
  - Nilai tidak pernah ditulis ke log.
- `lib/auth/social-limit.ts`: kecualikan `health` dari blokir sosial, sama seperti `workout`. Data kesehatan bukan fitur sosial, jadi akun yang fitur sosialnya diblokir tetap bisa mencatat.
- `lib/data/health.ts`: `getMeasurements(accountId)` (riwayat terbaru dulu, maksimal 500 baris) dan `healthSummary(rows)`:
  - berat terakhir = baris terbaru yang punya berat;
  - IMT = berat / (tinggi/100)² dari baris terbaru yang punya keduanya, dibulatkan 1 desimal, tanpa kategori.
- `app/home/health/page.tsx`:
  - `PageHeader` "Kesehatan" dan `unstable_dynamicStaleTime = 0`;
  - dua `MetricCard` (Berat terakhir, IMT; "-" bila belum ada);
  - form tambah (`ActionForm`);
  - tabel riwayat (tanggal, tinggi, berat, IMT baris itu bila lengkap) dengan tombol Ubah dan Hapus;
  - satu kalimat "Hanya Anda yang bisa melihat data ini."
- `components/health/`: `measurement-form.tsx` (dipakai untuk tambah dan ubah) dan `measurement-table.tsx` (tombol hapus lewat `ActionForm`). Ubah membuka form yang sama berisi nilai baris itu.
- Menu: `{ href: "/home/health", label: "Kesehatan", icon: "visits" }` di `personal-shell.tsx`, tidak `primary`. Ikon lain yang tersedia dan cocok: `reports` (grafik). Saya pakai `visits` kecuali Anda pilih lain.

### Fase 3: ekspor dan privasi
- `lib/export/account.ts`: `add("kesehatan", fetchAll("body_measurements", "measured_on, height_cm, weight_kg, created_at", "account_id", accountId))`.
- `app/privacy/page.tsx`, butir data akun pribadi: tambah kalimat "Catatan kesehatan (tinggi dan berat badan per tanggal) hanya dapat dilihat oleh Anda, tidak ditampilkan ke klub, pelatih, teman, grup, feed, atau peringkat, dan dapat dihapus kapan saja."
- `app/sitemap.ts`: `LEGAL_UPDATED` ke tanggal hari itu.

## Perlu keputusan atau perhatian
- "Ubah" untuk tanggal yang sudah ada:
  - Rencana saya: menambah catatan di tanggal yang sudah tercatat ditolak dengan pesan, dan pengguna menekan Ubah di baris itu.
  - Alternatifnya menimpa diam-diam (upsert), tapi itu bisa menghapus tinggi badan yang sudah ada bila hanya berat yang diisi.
- Hapus akun dari `/home/settings` hanya berjalan untuk akun yang tidak terhubung ke klub atau organisasi (`lib/actions/account-delete.ts`). Untuk anggota, staf, dan pemilik, baris kesehatan tetap ada sampai akunnya bisa dihapus. Mereka tetap bisa menghapus tiap catatan sendiri. Tombol "hapus semua catatan kesehatan" di luar cakupan tugas ini.
- Halaman versi kebijakan privasi (`PRIVACY_VERSION`) tidak saya ubah kecuali Anda minta, karena perubahan ini menambah jenis data.

## Log fase

### Fase 1 (selesai)
- Berkas:
  - `supabase/migrations/20250101000058_body_measurements.sql`;
  - `supabase/tests/health_phase1.sql` (baru);
  - `supabase/tests/accounts_phase1.sql`: satu baris kesehatan untuk pemilik dan anggota di klub yang sama sebelum loop isolasi, ditambah asersi bahwa sesi pemilik klub hanya membaca barisnya sendiri.
- Lokal:
  - database baru dari migrasi 001-057 (Postgres 17, shim `auth`/`storage`/`extensions`); rangkaian tes 12 berkas lulus sebelum 058;
  - setelah 058, 13 berkas dijalankan masing-masing di salinan baru dengan `-v ON_ERROR_STOP=1` dan semua keluar dengan kode 0: `accounts_phase1`, `club_join_phase4`, `deletion_phase6`, `friends_feed_phase3`, `groups_events_phase5`, `health_phase1` (mencetak `health_phase1 OK`), `invitations_phase5`, `leaderboards_phase7`, `organization_members_phase2`, `permissions_phase3`, `report_review_phase6`, `seats_phase4`, `workout_logs_phase2`.
- Hosted (`gmldacyjdbsdofqqaqry`):
  - `list_migrations` berakhir di 057;
  - isi 058 dijalankan dalam `begin; ... rollback;` lewat `execute_sql`, hasilnya tabel terbentuk, 1 policy, `anon` tanpa select, `authenticated` tidak bisa memanggil fungsi trigger;
  - setelah rollback, `to_regclass('public.body_measurements')` null dan fungsi tidak ada.
- Penerapan ke hosted menunggu permintaan owner.
- Pemeriksaan: `npx next typegen && npx tsc --noEmit` (lihat commit fase).
- Blocker: tidak ada.

### Fase 2 (selesai)
- Berkas baru:
  - `lib/validations/health.ts`;
  - `lib/data/health.ts` (`bmi`, `healthSummary`, `getHealthData`, maksimal 500 baris);
  - `lib/actions/health.ts` (`addMeasurement`, `updateMeasurement` lalu redirect ke `/home/health`, `deleteMeasurement`);
  - `app/home/health/page.tsx` (`unstable_dynamicStaleTime = 0`, mode ubah lewat `?ubah=<id>`);
  - `components/health/measurement-form.tsx`, `components/health/measurement-table.tsx`.
- Berkas diubah:
  - `lib/validations/limits.ts`: `HEIGHT_*_CM`, `WEIGHT_*_KG`, sama dengan CHECK;
  - `lib/auth/social-limit.ts`: scope `health` tidak diblokir sanksi sosial;
  - `components/shared/personal-shell.tsx`: menu "Kesehatan".
- Ikon menu: `reports`, bukan `visits` seperti rencana, karena `visits` sudah dipakai menu Latihan.
- Validasi: koma diterima sebagai pemisah desimal; lebih dari satu desimal ditolak (kolom `numeric(4,1)` akan membulatkan diam-diam). Semua pesan berbahasa Indonesia.
- Nilai ukur tidak ditulis ke log atau `audit_log`.
- Pemeriksaan: `npx next typegen && npx tsc --noEmit` lulus.
- Blocker: tidak ada.

### Fase 3 (selesai)
- Berkas:
  - `lib/export/account.ts`: berkas `kesehatan.csv`;
  - `app/privacy/page.tsx`: catatan kesehatan masuk daftar data akun pribadi, ditambah kalimat bahwa hanya pemilik yang melihatnya;
  - `app/sitemap.ts`: `LEGAL_UPDATED` 2026-10-19;
  - `app/home/settings/page.tsx`: deskripsi hapus akun menyebut catatan kesehatan.
- Perbaikan dari e2e:
  - `components/health/measurement-form.tsx`: input jadi teks `inputMode="decimal"`. `type="number"` di browser berlokal Inggris mengosongkan "70,5" tanpa pesan.
  - `components/health/measurement-table.tsx`: baris `whitespace-nowrap`. Di HP "168 cm" terpotong dua baris; tabel digulir horizontal seperti tabel Latihan.
- E2E lokal (Next dev + PostgREST + Postgres 17, database `h_e2e` dari migrasi 001-058, Playwright `timezoneId` Asia/Jakarta):
  - skrip `/tmp/hb/e2e/health.cjs`, kode keluar 0, 26 pemeriksaan lulus;
  - yang dicek:
    - menu tampil dan keadaan kosong;
    - simpan berat saja dengan koma desimal, tanpa IMT;
    - IMT 22,5 untuk 170 cm/65 kg;
    - tolak tanggal besok, berat 301, tinggi 49, "abc", "65,25", isian kosong, dan tanggal ganda, semuanya dengan pesan Indonesia;
    - ubah (form terisi, tersimpan, IMT dihitung ulang) dan hapus;
    - akun B membaca 0 baris lewat PostgREST dengan token sesinya, `anon` 401;
    - ekspor ZIP memuat `kesehatan.csv` berisi barisnya;
    - hapus akun mengosongkan baris;
    - nilai tidak muncul di log Next/PostgREST/proxy maupun `audit_log`.
  - Tangkapan layar HP 390 px dicek.
  - Catatan lingkungan uji: `service_role` lokal perlu `bypassrls` dan grant penuh (meniru Supabase), dan `auth_rate_limits` dikosongkan di antara putaran; keduanya bukan bug produk.
- Pemeriksaan: `npx next typegen && npx tsc --noEmit` lulus.
- Blocker untuk push: `buildAccountExport` melempar galat bila satu tabel gagal dibaca, jadi tanpa migrasi 058 di hosted seluruh ekspor akun di production gagal. Halaman `/home/health` dari Fase 2 sudah ter-deploy; tanpa tabel, halaman tampil kosong dan simpan menampilkan "Gagal menyimpan catatan kesehatan". Urutan aman: terapkan 058 ke hosted, ganti versinya ke 20250101000058, lalu push.

### Penerapan hosted (2026-10-19)
- `apply_migration` lalu versi diganti ke `20250101000058`. Tiga versi teratas: 058 `body_measurements`, 057, 056.
- Dicek setelahnya: tabel ada, RLS aktif, 1 policy, `anon` tanpa select, `authenticated` punya select, `authenticated` tidak bisa memanggil fungsi trigger, trigger terpasang.

### Versi kebijakan privasi (2026-10-19)
- `PRIVACY_VERSION` dinaikkan ke `2026-10-19.2` atas permintaan owner.
- Tanggal "Berlaku sejak" dikembalikan ke 12 Oktober 2026 sesuai permintaan owner (sebelumnya diubah ke 21 Oktober 2026).
- Versi sebelumnya `2026-10-21` memakai tanggal yang belum terjadi; tabel `consents` di hosted masih kosong, jadi tidak ada persetujuan tercatat dengan versi itu.
