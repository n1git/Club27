# more-sports progress

Status: Phases 0 to 3 done; migration 065 is applied to hosted.

- [x] Phase 0: read the sport data and code, two questions answered
- [x] Phase 1: migration (not applied)
- [x] Phase 2: public side checks
- [x] Phase 3: hosted notes

## Phase 0

Read: `20250101000018_club_types`, `20250101000020_modules_onboarding`, `..21_resource_booking`, `..22_commerce`, `..23_sport_club_types`, and `20250101000046_rename_schema` (renamed `sort` to `sort_order` on `club_types` and `club_type_presets`). Later migrations only reference `club_types(code)` as a foreign key (`workout_logs.sport`, `posts.sport`, challenges) and add `max_m_per_min` (swimming only).

Current rows: `swimming`, `gym`, `tennis`, `padel`, `pilates`, `yoga` are `ready`; `crossfit`, `martial_arts`, `dance`, `badminton`, `futsal`, `basketball`, `other` exist as `soon` with empty terms. `mini_soccer`, `volleyball`, `pickleball`, `table_tennis` and `running` do not exist yet. Next free migration number: `065`.

### What must change in code

Nothing. No hard-coded club-type code outside defaults and seeds (`lib/validations/onboarding.ts` defaults to `swimming`; `scripts/seed-demo.ts` seeds six existing types). Everything else reads the tables:
- Registration (`/signup`), "Tambah klub" (`create-tenant-form`) and Upgrade (`create-organization-form`) list `getReadyClubTypes()` ordered by `sort_order`.
- `/sports/<code>` (the old `/olahraga/<code>`) and `sitemap.ts` read `getPublicClubTypes()` and show only `ready` types; the text comes from `describe()` (only modules the type has) and the terms.
- The landing `BusinessSection` lists every `ready` type as a link and "Segera hadir" only while some type is `soon`.
- Onboarding: the facility step is shown only when the club has `resource_booking`, and `getResourcePreset()` returns null without a preset row; `FacilityForm` then falls back to kind `other`, the resource term and defaults. So `running` (no `resource_booking`, no presets) works.
- Side effect to know: workout sport pickers (`/home/workouts`, challenges, group and club boards, home) also read `getReadyClubTypes()`, so every new sport becomes a loggable workout sport automatically; labels strip the "Klub " prefix.

### Question 1: can a walk-in customer book a facility?

Only through staff. `book_resource` (admin and receptionist only) accepts either a member or a guest name (`p_guest_name`, optional `p_guest_phone`; exactly one of them, otherwise `RB008`). There is no public or signed-out booking. A signed-in member books through `book_resource_as_member`, which requires the club to have `resource_booking` and `member_portal` and the member to have an active subscription (`RB006` otherwise). So a pay-per-hour customer without a package cannot self-book at a futsal or badminton club today; staff book for them as a guest.

### Question 2: is a booking paid online at booking time?

No. Booking stores the price (`resources.price_per_slot`) and shows it; no payment happens when booking and Midtrans is only used for platform subscriptions. Payment is at the cashier: the point of sale can add a `booking` line (`order_items.booking_id`), and when that order is paid the booking gets `paid_at`.

### Decisions where the task text was open (flagged)

- Class-based sports `crossfit`, `martial_arts`, `dance` get `resource_booking` and `pos` like `pilates` and `yoga`, because the task gives them a resource term and a preset (a preset is only used when `resource_booking` is on). `running` follows the task literally: the class-based list only, no `resource_booking`, no `pos`, no presets. If you want the literal module list for the three, drop `resource_booking` and `pos` from them in the migration (their presets would then be unused).
- Location terms for the class-based sports match their resource instead of "Lokasi Lapangan": `Lokasi Box`, `Lokasi Latihan`, `Lokasi Studio`.
- Preset kind (the table only allows `court`, `lane`, `studio`, `room`, `floor`, `other`): venue sports and `table_tennis` use `court`; `crossfit`, `martial_arts` and `dance` use `studio`; `other` uses `other`.
- `sort_order` after `yoga` (6): futsal 7, badminton 8, mini_soccer 9, basketball 10, volleyball 11, pickleball 12, table_tennis 13, crossfit 14, martial_arts 15, dance 16, running 17, other 18.

## Phase 1: migration (NOT applied)

`supabase/migrations/20250101000065_more_sports.sql`: `club_types` upsert (`on conflict (code) do update`) for 12 types, then delete and re-insert `club_type_modules` and `club_type_presets` only for those 12 types. `tennis`, `padel`, `pilates`, `yoga`, `swimming` and `gym` are untouched (the md5 of their types, modules and presets is the same on a database built without and with 065).

Checks on a fresh local database through 065:
- Run twice: the md5 of all `club_types` rows and of all `club_type_modules` rows is identical after the second run.
- `register_organization` succeeds for every one of the 18 ready types.
- Modules per type: venue sports `members, plans, billing, cash_ledger, payroll, promo, member_portal, resource_booking, pos` (+ `classes` for futsal, badminton, basketball, volleyball); crossfit adds `classes, checkin, resource_booking, pos`; martial_arts and dance `classes, resource_booking, pos`; `running` `members, plans, billing, cash_ledger, payroll, promo, member_portal, classes`; `other` the venue list plus `classes`.
- Presets: 11 new rows (none for `running`). Onboarding with a type that has no presets works: `getResourcePreset()` returns null and `FacilityForm` falls back to defaults; and `running` has no facility step because it has no `resource_booking`.

## Phase 2: public side

Browser checks against that database:
- `/signup` (type field on step 2) lists 18 types in `sort_order`, and `?jenis=running` preselects it. "Tambah klub" and Upgrade use the same `getReadyClubTypes()`.
- `/sports/<code>` renders for all 12 new types (200, title "Aplikasi manajemen ...", own terms); `sitemap.xml` lists all 12; the landing "Siap dipakai" pills show every ready type and the "Segera hadir" line is gone because no type is `soon`.
- Onboarding: `futsal` suggests `Lapangan Futsal {n}`, 1, capacity 1; `crossfit` `Box {n}`, 1, capacity 15; `other` `Fasilitas {n}`, 1, capacity 1; `running` shows "Titik Kumpul" as the location step, no facility form and no Fasilitas, Booking or Kasir in the menu.

One fix was needed (copy, not a feature): the shared feature text on `/sports/<code>` claimed the cashier in the cash ledger text, "booking" and "pesanan" in the member portal text and booking and sales in the reports text for every type. They now depend on the modules the sport has (`components/landing/features-section.tsx`, `sport-page.tsx`). Text for types with all modules is unchanged except "pesanan miliknya sendiri" replacing "pesanannya sendiri".

Left as is (list for the owner, nothing built):
- A walk-in customer cannot book by themselves (see Phase 0); a pay-per-hour futsal or badminton customer without a package needs staff to book for them. Members also need an active package to self-book, which suits clubs that sell packages, less a pure hourly venue.
- `/sports/running` still shows a "Fasilitas" row in the terms list (the default term) although it has no facility booking.
- Workout sport pickers now list all 18 ready sports (including "Lainnya"), because they read the ready club types.
- `sitemap.ts` keeps its manual `LANDING_UPDATED` date; bump it when you apply the migration.
- Lighthouse, e2e of a full member booking per sport and SEO text per sport were not run.

## Phase 3: hosted (not applied)

Dry run needs `SUPABASE_ACCESS_TOKEN` and the database password: `supabase db push --dry-run`. Without them, the project's rolled-back-transaction dry run applies. Then `apply_migration` for `20250101000065_more_sports.sql` and rename the history version to `20250101000065`. Hosted is currently at 064.

## Phase 3 result: applied to hosted

Owner approved ("oke"). `supabase db push --dry-run` is not available here (no access token or database password), so the migration ran first on hosted in a statement that ended with a deliberate exception (rolled back): 18 ready, 0 soon, 175 module links, 17 presets, `running` with 8 modules and no `resource_booking`, `pos` or presets. Then `apply_migration` and the history row renamed to `20250101000065 more_sports`. Hosted now: 18 ready types, 0 soon, 175 `club_type_modules`, 17 `club_type_presets`; existing organizations untouched.
