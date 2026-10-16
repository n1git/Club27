# rbac-seat — akun universal, role kustom, seat

Status: Fase 0 (audit) selesai, menunggu keputusan owner. Belum ada perubahan kode atau database.

- [x] Fase 0 - audit dan rencana (dokumen ini)
- [ ] Fase 1 - akun universal dan konteks personal
- [ ] Fase 2 - keanggotaan organisasi dan base role
- [ ] Fase 3 - permission kustom, RLS, dan guard
- [ ] Fase 4 - seat, billing, dan masa tenggang
- [ ] Fase 5 - undangan, reset kata sandi, autentikasi ulang, transfer, upgrade member ke org
- [ ] Fase 6 - siklus hapus organisasi (purge nonaktif sampai kebijakan retensi diputuskan)

Basis audit: `main` @ `abbc0b6`, migrasi repo 001-038, query read-only ke Supabase `gmldacyjdbsdofqqaqry` tanggal 2026-10-16.
Label: **F** = fakta terverifikasi (file/query), **R** = rekomendasi desain, **A** = asumsi/belum terbukti.

## 1. Arsitektur autentikasi dan identitas saat ini

- F: Auth custom. JWT HS256 dibuat aplikasi (`lib/auth/jwt.ts`, `SUPABASE_JWT_SECRET`), cookie `app_session` 7 hari (`lib/auth/session.ts`). Claim: `sub`, `role: authenticated`, `app_role`, `tenant_id`, `org_id`, `club_pending?`, `email`, `full_name`, `iat`.
- F: `sub` = `profiles.id` (profil per klub), jadi `auth.uid()` di RLS = id profil per klub; `current_tenant_id()` membaca claim `tenant_id` (002).
- F: Tiga tabel identitas dengan kata sandi masing-masing:
  - `org_owners` (012): `organization_id not null`, `email unique`, `password_hash`, lockout, `username` (033). Satu baris = satu org, jadi satu email pemilik = satu organisasi.
  - `auth_credentials` (002): kata sandi staf/pelatih per `profile_id`.
  - `member_accounts` (017): akun anggota lintas klub.
- F: Email unik lintas ketiganya lewat trigger `enforce_owner_email`, `enforce_profile_identity`, `enforce_member_account_email` (017) + index `profiles_login_email_idx` (unik `profiles.email` bila `owner_id` dan `member_account_id` null). Akibatnya: satu email = satu jenis identitas; pelatih/staf hanya satu klub; pelatih tidak bisa sekaligus anggota; pemilik tidak bisa sekaligus anggota.
- F: Username unik per tabel (`org_owners`, `member_accounts`, `profiles`, `superadmins`, 033) + trigger `enforce_username`.
- F: Login `app/api/auth/login/route.ts` mencari berurutan `org_owners` → `member_accounts` → `profiles`+`auth_credentials`. Pemilik masuk ke profil `admin` klub tertua; anggota ke klub pertama atau `club_pending` kalau punya beberapa klub.
- F: `checkSession` (`lib/auth/guard.ts`) membaca profil dari DB di setiap request: aktif, `tenant_id` dan `role` harus sama dengan claim, `sessions_valid_after`, tenant aktif, billing lock, `org_owners.is_active`, `member_accounts.is_active`, `members.is_active`. Jadi perubahan role di DB langsung mencabut sesi lama ("revoked").
- F: Ganti konteks sudah ada: `switchTenant` (`lib/actions/owner.ts`, pemilik antar klub, tanpa kata sandi) dan `switchClub` (`lib/actions/member.ts`, anggota antar klub). Keduanya membuat JWT baru.
- F: Logout (`app/api/auth/logout/route.ts`) mengisi `sessions_valid_after` di semua profil milik pemilik/akun anggota tersebut.
- F: `proxy.ts` hanya memverifikasi tanda tangan JWT + `canAccessPath(app_role, path)`; otorisasi sesungguhnya ada di guard dan RLS.
- F: Superadmin terpisah (`superadmins`, `SUPERADMIN_JWT_SECRET`, audience `club27-superadmin`, TOTP wajib).
- F: Profil anggota wajib punya baris `members` (`check_member_profile_link`) dan `role = 'member'` ⇔ `member_account_id` terisi (`profiles_member_account_role`, 017).

## 2. Model target: akun universal dan multi-konteks (R)

- `accounts`: identitas universal (email unik, `password_hash`, lockout, `username`/handle, `email_verified_at`, `is_active`, `sessions_valid_after`). Satu-satunya tempat kata sandi. Calon jangkar fitur sosial nanti.
- `profiles` tetap sebagai konteks per klub dan tetap menjadi `sub` JWT untuk konteks klub, ditambah `account_id` (FK `accounts`), unik `(account_id, tenant_id)`. Dengan begitu `auth.uid()` = profil klub tetap berlaku, dan bentuk ratusan policy cukup diganti helpernya, bukan ditulis ulang total.
- `organization_members(account_id, organization_id, base_role in ('p_owner','owner','staff'), status)` + partial unique index satu `p_owner` per org. Ini pengganti `org_owners` dan dasar hitungan seat.
- Konteks JWT baru `ctx in ('personal','member','org')`, ditambah `account_id`:
  - `personal`: `sub` = `accounts.id`, tanpa `tenant_id`, sehingga RLS klub mengembalikan nol baris. Ini untuk akun tanpa org dan fitur sosial nanti.
  - `member`: profil klub dengan data murid (`members.profile_id`).
  - `org`: profil klub milik anggota backend atau assignment frontend (coach/kasir) di klub itu.
- Permission tidak disimpan di JWT. Dibaca live dari DB oleh `has_permission()` (SQL) dan guard (TS), jadi pencabutan berlaku seketika tanpa menunggu token kedaluwarsa.
- Pilihan "Login as Org Owner" / "Login as Member" = memilih profil/konteks lalu mint JWT baru, memperluas pola `switchTenant`/`switchClub`. Tidak membuat identitas baru.

## 3. Organisasi vs klub, cakupan permission

- F: Hierarki `organizations` → `tenants` (klub, `tenants.organization_id`) → data operasional dengan `tenant_id`. Langganan di tingkat org (`organization_subscriptions`). `locations` per klub. Pemilik punya satu profil `admin` per klub (`profiles.owner_id`).
- R: Base role (p_owner/owner/staff) melekat di org (`organization_members`). p_owner/owner otomatis berlaku di semua klub org. Staff bisa dibatasi ke klub tertentu lewat tabel penugasan klub (mis. `organization_member_clubs`). Kosong = semua klub atau tidak ada? Lihat D2.
- R: Assignment frontend (coach, kasir, dll.) melekat di klub, karena kelas, booking, pesanan, dan payroll semuanya `tenant_id`.
- R: Role kustom dimiliki org (`organization_roles`), permission dari katalog tetap (`permissions(code, module)`), relasi `role_permissions`, penugasan role ke profil klub atau anggota org.

## 4. Pemetaan role lama → model baru

| Lama | Baru (R) | Catatan |
|---|---|---|
| `org_owners` + profil `admin` dengan `owner_id` | `accounts` + `organization_members.base_role = 'p_owner'` | Production: 3 org, masing-masing 1 pemilik. |
| `admin` tanpa `owner_id` | `owner` atau `staff` + role "Admin" | Production: 0 baris. |
| `receptionist`, `finance` | `staff` + role preset "Resepsionis"/"Keuangan" **atau** member + role frontend | Belum diputuskan (D11). Production: 0 baris. |
| `coach` (+ `is_head_coach`) | profil klub + role "Pelatih"/"Kepala Pelatih", tanpa baris `members` | Production: 1 baris. |
| `member` | profil klub + baris `members` (murid) | Production: 1 baris, 1 `member_accounts`. |

## 5. Inventaris pemakaian role lama (F)

- Live production: 60 policy di 35 tabel; 46 policy memakai `is_admin`/`is_coach`/`is_receptionist`/`is_finance`/`is_head_coach`/`is_member`/`current_app_role`/`owner_id`/`current_profile_is_owner`; 39 fungsi `public` memuat string role atau helper tersebut.
- Helper SQL: `current_app_role` (003), `is_admin`, `is_coach` (003), `is_receptionist`, `is_finance`, `is_head_coach`, `coach_owns_class`, `coach_substitutes_class` (016), `coach_owns_member` (013), `is_member`, `current_member_id`, `is_active_user` (017), `current_profile_is_owner` (025). Trigger `enforce_profile_billing` (016) meng-hardcode empat peran staf. `organization_internal_users` (016) menghitung pemilik + admin/coach/receptionist/finance.
- TS inti: `lib/auth/roles.ts` (`AppRole`, `STAFF_ROLES`, `ROLE_LABEL`, `roleHome`, `profilePath`, `ADMIN_SECTION_ACCESS`, `canAccessPath`), `lib/auth/guard.ts`, `lib/auth/owner.ts`, `lib/auth/head-coach.ts`, `proxy.ts`.
- `requireActionRole` dipakai di hampir semua `lib/actions/*` (admin; admin+finance; admin+receptionist; admin+coach; member). `requireRole` di layout/template `app/admin`, `app/coach`, `app/member`, serta halaman kasir, booking, pesanan, check-in, audit, produk, fasilitas, onboarding. `requireOwner` di `app/admin/klub` dan `/langganan`.
- Perbandingan `app_role` langsung: `app/admin/billing/invoices`, `schedule`, `members/[id]`, `pesanan`, `layout.tsx`, `app/checkin/route.ts`, `api/member/export`, `api/members/[id]/export`, `lib/actions/accounts.ts` (`RESETTABLE_ROLES`), `member-accounts.ts`, `schedule.ts`, `profile.ts`, `auth.ts`, `components/schedule/class-detail.tsx`, `app/admin/staff/page.tsx`; `.eq("role","coach")` di `lib/actions/coaches.ts`, `payroll.ts`, `lib/data/lookups.ts`, `organization`, `app/admin/coaches/*`.
- Logika khusus pelatih: `app/coach/**`, `app/admin/coaches/**`, `app/admin/payroll/**`, `coach_profiles`/`coach_certifications` (015), `members.coach_id`, `classes.instructor_id`/`substitute_id`, `payroll_runs`.
- Dampak: hampir seluruh lapisan otorisasi tersentuh. Strategi kompatibilitas di bagian 8.

## 6. Rencana perubahan skema, RLS, helper, JWT (R)

1. Migrasi tambah-saja (039+): `accounts`, `profiles.account_id`, `organization_members`, `permissions`, `organization_roles`, `role_permissions`, penugasan role, penugasan klub staff, kolom seat di `organization_subscriptions`, tabel token (undangan, reset kata sandi, autentikasi ulang) dengan pola hash `email_verifications` (028).
2. Backfill (tidak dipakai, lihat D1; hanya relevan bila nanti ada data nyata): `org_owners` → `accounts` + `organization_members(p_owner)`; `member_accounts` → `accounts`; staf/pelatih (`auth_credentials`) → `accounts`; isi `profiles.account_id`. Hash kata sandi dipindah apa adanya (bcrypt).
3. Helper baru `has_permission(p_code text)`, `current_account_id()`, `current_base_role()` (security definer, stable, revoke dari public/anon/authenticated kecuali yang dipanggil policy). Helper lama ditulis ulang di atas permission selama transisi, lalu dihapus di migrasi pembersihan.
4. Ganti 46 policy dan 39 fungsi secara bertahap per modul. Uji tiap modul sebelum lanjut.
5. Longgarkan `profiles_member_account_role` dan `check_member_profile_link` sehingga hanya berlaku untuk profil murid. Hapus trigger email lintas tabel setelah login pindah ke `accounts`.
6. JWT: tambah `ctx`, `account_id`. `app_role` diganti `base_role` atau dihapus. Sesi lama (tanpa `ctx`) dianggap invalid pada saat cutover, jadi semua pengguna login ulang.
7. `sessions_valid_after` dipindah atau ditambah ke `accounts` (logout dan ganti kata sandi mencabut semua konteks). `checkSession` tetap membaca DB per request.
8. Tabel lama (`org_owners`, `member_accounts`, `auth_credentials`, `platform_plans`, `platform_subscriptions`, `organizations.max_tenants`) didrop di migrasi terakhir terpisah, setelah owner OK.

## 7. Migrasi data production (F + R)

- F (query 2026-10-16): 3 `organizations`, 3 `org_owners`, 3 `tenants` (semua `swimming`), 5 `profiles` (3 admin pemilik, 1 coach, 1 member), 1 `member_accounts`, 1 `members`, 1 `auth_credentials`, 1 superadmin, 4 `audit_log`.
- F: langganan: 2 trial Standard bulanan (berakhir 2026-11-11 dan 2026-11-15, trial 30 hari), 1 Advanced tahunan `active` sampai 2027-10-14. `subscription_renewals`: 1 `paid` via Midtrans Rp2.875.000 (1 user), 2 `pending` manual (Rp2.875.000 dan Rp250.000).
- F: `supabase_migrations.schema_migrations` hosted berisi 18 versi bertimestamp 20261002-20261014, tidak sama dengan nama file repo (`20250101000001`-`038`). `supabase db push` biasa akan salah membaca riwayat.
- A: belum diketahui apakah 3 org ini pelanggan nyata atau uji coba (D1).
- Keputusan (D1): data uji dikosongkan saat cutover, tanpa backfill; `subscription_plans` dan `superadmins` dipertahankan. Ambil `pg_dump` sebelum setiap migrasi hosted. Terapkan dulu ke Supabase branch atau staging.

## 8. Risiko keamanan, breaking changes, kompatibilitas

- Risiko: helper permission salah = kebocoran antar-org. Mitigasi: `has_permission` selalu menyaring `current_tenant_id()`/org dari profil di DB, bukan dari input. Uji isolasi untuk setiap tabel ber-RLS.
- Risiko: konteks `personal`/`member` membawa claim org. Mitigasi: JWT konteks member/personal tanpa `org_id` backend; guard menolak permission backend kecuali `ctx = 'org'`.
- Risiko: akun digabung berdasarkan email lintas tabel lama. Saat ini dijamin tidak ada duplikat oleh trigger (F), tapi backfill tetap harus mengecek dan berhenti kalau ada konflik.
- Risiko: lockout per akun (bukan per tabel). Lockout bisa dipicu orang lain yang tahu email (risiko yang sudah tercatat di CLAUDE.md) dan sekarang berdampak ke semua konteks akun.
- Breaking: semua sesi logout saat cutover; URL `/coach`, `/admin`, `/member` tetap, akses ditentukan permission; `organization_internal_users` berubah menjadi hitungan seat, sehingga harga perpanjangan pelanggan yang punya pelatih aktif turun (D5).
- Breaking: `/privasi` dan `/syarat` menjanjikan data tidak dihapus otomatis. Kebijakan masa tenggang + purge mengubah janji itu (D7).
- Kompatibilitas: tambah-saja dulu, helper lama dibungkus permission, TS dipindah per modul, pembersihan di akhir. Rollback per fase: setiap migrasi punya skrip balik (`progress/rbac-seat/rollback/NNN.sql`), dan `pg_dump` sebelum terapan hosted.

## 9. Rencana pengujian (R)

Belum ada framework uji di repo (F: `package.json` tanpa skrip test). Usulan: skrip SQL yang bisa diulang (`supabase/tests/*.sql`, dijalankan di Supabase branch/lokal, set claim lewat `set_config('request.jwt.claims', ...)`) + checklist manual di dokumen ini.

Kasus yang diuji:
- Isolasi tenant per tabel ber-RLS (org A tidak melihat org B).
- Konteks personal tidak melihat data klub; konteks member tidak punya permission backend.
- Ganti konteks membuat JWT baru; claim lama ditolak setelah role/permission dicabut.
- Staff tanpa permission ditolak di RLS dan aksi server; owner tidak bisa mencabut/menghapus p_owner; hanya satu p_owner; transfer kepemilikan.
- Coach tanpa baris `members` bisa mengelola kelasnya (`coach_owns_class`), tidak bisa melihat kelas pelatih lain.
- Seat: trial = 1 seat; seat penuh memblokir; anggota backend di dua org dihitung di masing-masing org; coach/kasir/member tidak dihitung.
- Prorata bulanan/tahunan dihitung di server; pengurangan berlaku periode berikutnya; pembayaran Midtrans idempoten.
- Masa tenggang read-only (tulis ditolak `SW003`, baca boleh); purge dry-run tanpa orphan.
- Token reset/undangan: sekali pakai, kedaluwarsa, tidak membocorkan keberadaan email; autentikasi ulang wajib.

## 10. Jawaban pertanyaan arsitektur (R kecuali disebut F)

- Banyak org/klub/role tanpa duplikasi: satu `accounts`; peran org di `organization_members`; konteks klub di `profiles(account_id, tenant_id)` unik; role kustom lewat penugasan.
- Pemisahan akun/profil murid/membership/assignment coach: `accounts` = siapa; `profiles` = konteks di klub; `members` = data murid (opsional per profil); penugasan role = coach/kasir.
- Batas permission per org/klub: `has_permission` membaca base role org + penugasan role + penugasan klub untuk staff, difilter tenant/org dari profil di DB.
- Ganti konteks tanpa bocor: mint JWT baru per konteks (pola `switchTenant`), claim minimal, permission tidak di token, `checkSession` memvalidasi kecocokan profil-konteks di DB setiap request.
- Pencabutan: permission dibaca live; `accounts.sessions_valid_after` dan nonaktifnya `organization_members` membuat `checkSession` menolak sesi lama.
- Seat multi-org: `count(distinct account_id)` per `organization_id` dengan `base_role` backend aktif. Satu orang di dua org = satu seat di tiap org.
- Coach tanpa jadi murid: profil klub + role Pelatih; `instructor_id`/payroll tetap merujuk `profiles.id`; constraint murid hanya untuk profil yang punya baris `members`.
- Siap sosial: jangkarkan fitur sosial ke `accounts.id` dan `accounts.username` (handle global); konteks `personal`; jangan menautkan konten sosial ke `profiles` atau `tenant_id`. Tidak ada tabel sosial dibuat sekarang.
- Penghapusan vs retensi: opsi (a) hapus total; (b) hapus data pribadi + simpan catatan keuangan teranonim; (c) simpan sampai masa retensi hukum lalu hapus. A: kewajiban simpan pembukuan (UU KUP, setahuku 10 tahun) dan UU PDP perlu dicek ahli hukum. `subscription_renewals` adalah catatan pendapatan platform sendiri, kemungkinan wajib disimpan.

## Keputusan yang butuh persetujuan owner sebelum Fase 1

- D1 Dijawab owner 2026-10-16: tiga org di production adalah data uji coba (termasuk pembayaran Midtrans Rp2.875.000). Tidak ada pelanggan nyata. Owner mengizinkan data uji di production dikosongkan saat cutover, jadi backfill tidak wajib; skema baru boleh dimulai dari data kosong (tetap `pg_dump` dulu, `subscription_plans` dan `superadmins` dipertahankan).
- D2 Staff berlaku di semua klub org atau per klub yang ditugaskan? Default penugasan kosong = semua klub atau tidak ada?
- D3 Satu akun boleh jadi p_owner beberapa org dengan langganan terpisah per org (model sekarang per org)?
- D4 Trial 14 hari bertentangan dengan `trial_days` 30 (Standard) / 0 (Advanced) dan larangan mengubah paket. Ubah `trial_days`, atau trial 14 hari diatur di luar tabel paket? Trial 30 hari yang sedang berjalan tetap?
- D5 Hitungan seat (tanpa coach) menurunkan nominal perpanjangan pelanggan yang punya pelatih aktif. Setuju diterapkan ke pelanggan lama?
- D6 Masa tenggang read-only: siapa yang boleh login (backend, coach/kasir, member)? Ini menggantikan kunci langsung (`isBillingLocked`).
- D7 Kebijakan retensi dan purge: opsi a/b/c di atas, revisi `/privasi`/`/syarat`, dan latihan restore (`docs/RESTORE.md` belum pernah dijalankan).
- D8 Reset oleh admin yang menampilkan kata sandi sementara (`resetUserPassword`, `resetMemberPassword`): diganti link email atau tetap ada?
- D9 Undangan coach per klub atau per org?
- D10 Kasir = member + role (tanpa seat), tapi halaman kasir ada di `/admin/kasir` (UI backend). Boleh akun frontend mengakses halaman `/admin` tertentu lewat permission, atau perlu UI kasir terpisah?
- D11 Keuangan dan resepsionis: staff (makan seat) atau frontend (gratis)? Semua akses backoffice yang gratis = kebocoran seat.
- D12 Daftar mandiri member wajib verifikasi email (seperti registrasi org sekarang)?
- D13 Penyelarasan riwayat migrasi hosted (18 versi bertimestamp) dengan file repo sebelum migrasi baru: siapa dan bagaimana?
