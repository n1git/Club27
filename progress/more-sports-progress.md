# more-sports progress

Status: Phase 0 done.

- [x] Phase 0: read the sport data and code, two questions answered
- [ ] Phase 1: migration (not applied)
- [ ] Phase 2: public side checks
- [ ] Phase 3: hosted notes

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
