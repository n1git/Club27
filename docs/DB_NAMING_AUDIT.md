# Audit penamaan database

Sumber: skema hasil migrasi 001-042 (sama dengan hosted `club27`). 53 tabel, 12 view, 129 fungsi buatan sendiri (di luar ekstensi), ±90 trigger. Isi dokumen ini hanya inventaris dan usulan nama; belum ada yang diubah.

Kolom "Usulan" = saran saya. Kosong = nama sudah cukup jelas.

## 1. Kata yang paling membingungkan (prioritas rename)

| Nama sekarang | Artinya sebenarnya | Masalah | Usulan |
|---|---|---|---|
| `tenants` / `tenant_id` | Klub (satu tempat latihan) | Di UI dan docs disebut "klub", di database "tenant". `tenant_id` ada di 24 tabel, ±600 baris SQL, 99 baris TS | `clubs` / `club_id` |
| `organizations` | Akun bisnis pemilik (induk beberapa klub) | Jelas, tapi ada kolom mati `max_tenants` | tetap; hapus `max_tenants` |
| `members` | Murid/anggota klub | Bentrok dengan `organization_members` (isinya pemilik dan staf, bukan murid) | `club_members` atau `students` |
| `organization_members` | Pemilik dan staf yang memegang seat | Bentrok dengan `members`; juga masih punya kolom `password_hash`, `username`, lockout sisa `org_owners` | `organization_seats` atau `organization_staff` |
| `profiles` | Satu identitas per klub per akun (owner/staf/murid) | Nama terlalu umum; isinya konteks login di sebuah klub | `club_profiles` |
| `accounts` | Akun login universal | Jelas | tetap |
| `subscriptions` | Langganan paket murid (membership) | Bentrok dengan `organization_subscriptions` (langganan platform) dan `subscription_*` lain | `member_memberships` |
| `membership_packages` | Paket yang dijual klub ke murid | Pasangan dari `subscriptions` | tetap, atau `membership_plans` |
| `subscription_plans` | Paket harga platform (Standard/Advanced) | Mirip `membership_packages` dan `platform_plans` | `platform_plans` (nama itu dipakai tabel lama, drop dulu) |
| `organization_subscriptions` | Langganan platform milik organisasi | Panjang tapi benar | tetap |
| `bookings` | Booking murid ke kelas | Bentrok dengan `resource_bookings` | `class_bookings` |
| `classes.instructor_id` vs `members.coach_id` vs `payroll_runs.coach_id` | Orang yang sama (pelatih) | Dua istilah: instructor dan coach | pilih satu: `coach_id` |
| `billing_cycle` (packages) vs `billing_period` (platform) | Bulanan/tahunan | Dua nama untuk konsep serupa | satukan `billing_period` |
| `price_per_user_month` | Harga per seat per bulan | "user" sudah tidak benar sejak model seat | `price_per_seat_month` |
| `subscription_renewals.users` | Jumlah seat | sama | `seats` |
| `platform_organization_usage.internal_users` / `organization_internal_users()` | Seat terpakai | sama | `seats_used` / `organization_seats_used()` |
| `sort` vs `sort_order` | Urutan tampil | Dua nama (`club_types.sort`, `platform_modules.sort` vs `permissions.sort_order`) | `sort_order` |
| `promo` | Pengumuman/promo | Satu-satunya tabel tunggal; lainnya jamak | `promos` |
| `audit_log.at` | Waktu kejadian | Nama kolom pendek menyerupai kata kunci | `occurred_at` |

## 2. Tabel menurut domain

### Identitas dan akses
- `accounts`: satu orang satu baris (email, username, kata sandi, kunci login, `sessions_valid_after`).
- `profiles`: konteks akun di satu klub (`role` owner/staff/member, `org_role_id`, `owner_id`, `member_account_id`).
- `organizations`, `organization_members` (`base_role` p_owner/owner/staff), `organization_member_clubs` (staf ditugaskan ke klub mana).
- `organization_roles`, `role_permissions`, `permissions`, `role_presets`, `role_preset_permissions`: role kustom dan katalog izin.
- `auth_rate_limits`, `email_verifications`: pembatas percobaan dan token verifikasi.
- `superadmins`, `superadmin_sessions`, `superadmin_recovery_codes`: login platform.
- Warisan (akan dihapus di migrasi pembersihan): `auth_credentials`, `member_accounts`, `platform_plans`, `platform_subscriptions`, `organizations.max_tenants`, kolom `password_hash`/`username`/lockout di `organization_members`.

### Klub dan modul
- `tenants` (klub: nama, logo, jenis, status), `locations`, `club_types`, `club_type_modules`, `club_type_presets`, `platform_modules`, `tenant_module_overrides`.

### Murid dan kelas
- `members` (+ `coach_certifications` milik pelatih), `classes`, `class_types`, `bookings`, `subscriptions`, `membership_packages`, `invoices`.

### Check-in dan fasilitas
- `checkin_points`, `checkins`, `resources`, `resource_hours`, `resource_bookings`.

### Kasir dan keuangan
- `products`, `orders`, `order_items`, `order_payments`, `order_counters`, `cash_ledger`, `payroll_runs`.

### Billing platform
- `subscription_plans` (harga), `organization_subscriptions` (status, seat, periode), `subscription_renewals` (perpanjangan dan beli seat, `kind`), `subscription_reminders`.

### Lain-lain
- `audit_log`, `consents`, `promo`.

### View
- Laporan: `report_revenue`, `report_cash_flow`, `report_payroll_cost`, `report_outstanding`, `report_member_counts`, `report_revenue_by_program`, `cash_ledger_with_balance`.
- Murid: `subscription_usage` (staf) dan `my_subscription_usage` (murid), `member_names` (nama untuk keuangan), `dormant_members`, `checkin_daily_counts`, `checkin_hourly_30d`, `instructors`.
- Platform: `platform_organization_usage`, `platform_tenant_usage`.

## 3. Kolom yang mudah salah dibaca

- `profiles.owner_id` menunjuk ke `organization_members` (bukan ke akun); `profiles.member_account_id` menunjuk ke `member_accounts` lama. Usulan setelah pembersihan: `organization_member_id`.
- `members.profile_id` = profil login murid (boleh kosong bila belum diaktifkan).
- `cash_ledger.direction` (in/out), `invoices.status`, `orders.status`: nilai teks bebas dengan CHECK; dokumentasi nilai ada di migrasi.
- `subscription_renewals.provider_ref` / `payment_order_id` / `payment_url`: tiga kolom untuk satu pembayaran gateway; boleh digabung jadi satu `payment_*` set bila rename.
- `tenants.slug`, `consents.subject_type/subject_id` (polimorfik), `order_items.kind`.

## 4. Fungsi menurut kelompok

| Kelompok | Fungsi | Tugas |
|---|---|---|
| Hak akses (RLS) | `has_permission`, `profile_permissions`, `is_instructor`, `is_member`, `is_active_user`, `current_tenant_id`, `current_member_id`, `current_profile_is_owner`, `current_profile_kind` | Membaca siapa yang login dan izinnya dari JWT. Usulan: `current_tenant_id` -> `current_club_id`. |
| Kepemilikan kelas/murid | `coach_owns_class`, `coach_owns_member`, `coach_substitutes_class`, `coach_substitutes_member` | Pelatih hanya boleh menyentuh kelas/murid miliknya (atau pengganti). |
| Modul klub | `club_has_module`, `current_club_has_module`, `current_club_modules`, `set_club_module`, `complete_onboarding` | Modul aktif per klub. |
| Pendaftaran | `register_organization`, `register_organization_unverified`, `verify_registration`, `discard_unverified_registration`, `create_tenant_for_owner`, `create_tenant_row`, `seed_organization_roles`, `activate_member_account` | Membuat organisasi, klub, pemilik, dan role awal. |
| Username/email | `suggest_username`, `username_taken`, `username_reserved`, `enforce_username`, `enforce_account_email`, `enforce_owner_email`, `enforce_member_account_email`, `enforce_identity_account`, `enforce_profile_identity` | Keunikan username dan email. Beberapa sisa model lama, hapus saat pembersihan. |
| Kelas dan booking | `book_class`, `cancel_booking`, `set_booking_status`, `enforce_booking_rules`, `enforce_booking_capacity`, `protect_attended_class`, `enforce_class_substitute`, `enforce_classes_instructor_role` | Aturan booking kelas dan pelatih pengganti. |
| Fasilitas | `book_resource`, `book_resource_as_member`, `create_resource`, `set_resource_hours`, `resource_availability`, `resource_max_overlap`, `resource_booking_insert`, `resource_utilization`, `enforce_resource_*`, `sync_class_resource_booking` | Booking fasilitas dan kapasitas. |
| Check-in | `checkin_token`, `checkin_token_for`, `checkin_window`, `checkin_core`, `record_checkin`, `manual_checkin` | QR berputar dan pencatatan kunjungan. |
| Tagihan murid | `generate_invoices_for_period`, `create_invoice_for_session_pack_subscription`, `mark_invoice_paid`, `void_invoice`, `protect_final_invoice`, `audit_invoice_status_change` | Tagihan bulanan dan paket sesi. |
| Kasir | `create_order`, `create_order_once`, `add_order_payment`, `add_order_payment_once`, `order_record_payment`, `order_settle`, `void_order`, `next_order_number` | Pesanan, pembayaran, stok, void. |
| Penggajian | `create_payroll_run`, `protect_posted_payroll`, `enforce_payroll_coach_role` | Gaji pelatih ke buku kas. |
| Langganan platform | `subscription_phase`, `enforce_billing_gate`, `enforce_org_writable`, `enforce_seat_limit`, `enforce_org_max_tenants`, `enforce_subscription_limits`, `set_initial_seats`, `seat_quote`, `request_seat_purchase`, `request_renewal`, `confirm_renewal`, `expire_subscriptions`, `set_organization_status`, `platform_quote`, `organization_internal_users`, `enforce_member_billing`, `enforce_owner_billing`, `enforce_profile_billing`, `enforce_tenant_billing_gate` | Fase langganan, seat, harga, dan gerbang tulis. |
| Privasi dan audit | `anonymise_member`, `log_audit`, `protect_audit_log`, `stamp_consent`, `audit_*` | Hapus data murid, log, persetujuan. |
| Pelindung umum | `enforce_*_tenant`, `enforce_same_tenant_refs`, `enforce_*_refs`, `set_updated_at`, `stamp_client_request_id`, `stamp_manual_ledger_entry`, `rate_limit_exceeded`, `hit_rate_limit` | Mencegah referensi lintas klub, mengisi `updated_at`, idempotensi, pembatas laju. |

Pola awalan fungsi: `enforce_*` = trigger penolak (±40), `protect_*` = trigger yang melarang ubah/hapus, `audit_*` = trigger log, `stamp_*` = trigger yang mengisi nilai, `current_*` = pembaca konteks JWT, sisanya RPC dari aplikasi.

Usulan nama fungsi: `current_tenant_id` -> `current_club_id`; `create_tenant_for_owner`/`create_tenant_row` -> `create_club_for_owner`/`create_club_row`; `enforce_org_max_tenants` -> `enforce_org_club_limit`; `organization_internal_users` -> `organization_seats_used`; `checkin_*` konsisten (`check_in` vs `checkin`: pilih satu).

## 5. Trigger: nama tidak konsisten

- Pada `organization_members` masih ada `org_owners_enforce_billing`, `org_owners_enforce_email`, `org_owners_identity_account`, `org_owners_set_updated_at` (sisa nama tabel lama).
- Pola nama lain rapi (`<tabel>_<aksi>`); `a00_org_writable` sengaja berawalan `a00_` agar jalan paling dulu.

## 6. Dampak kalau rename

- Postgres otomatis mengikuti `alter table ... rename` untuk FK, index, policy, view, dan trigger. Isi fungsi plpgsql/sql TIDAK ikut berubah: semua fungsi yang menyebut nama lama (puluhan) harus ditulis ulang.
- Kode TS memanggil tabel dengan string (`from("profiles")` 32 kali, `organization_members` 18, `members` 17, `tenants` 12) dan embed PostgREST yang memakai nama FK (mis. `profiles!classes_instructor_id_fkey`). Perlu diubah bersamaan.
- Klaim JWT `tenant_id`, setting Postgres `club27.*`, skrip seed, tes SQL, docs, dan CLAUDE.md ikut.
- Urutan aman: (1) pembersihan tabel/kolom warisan dulu (mengurangi yang harus di-rename), (2) satu migrasi rename + tulis ulang fungsi, (3) ubah TS dan tes dalam commit yang sama, (4) uji regresi penuh (SQL, e2e) sebelum terapan hosted. Karena database produksi masih kosong, ini waktu termurah untuk melakukannya.
- Rename paling berisiko: `tenants`/`tenant_id` (menyentuh semua policy) dan `members`/`profiles` (paling banyak dipakai kode).
