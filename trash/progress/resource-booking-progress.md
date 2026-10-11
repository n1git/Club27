# resource-booking progress

Generic facilities and a booking engine, per-club module toggles, and a post-signup onboarding. One architecture for courts, lanes, studios and gym floors.

## Status

- [x] Phase 0: preparation and plan. OK received ("you decide"): all defaults accepted.
- [x] Phase 1: modules and onboarding (`020_modules_onboarding.sql`)
- [x] Phase 2: resources and booking, database and server (`021_resource_booking.sql`)
- [x] Phase 3: booking UI
- [x] Phase 4: cleanup and final checks

## Repository assessment

- Dependency: `gym-checkin` is finished (all phases in its progress file, last commit `1e2b1f0`). `main` is clean and in step with `origin/main`; nothing from other sessions since.
- Patterns to extend, not rewrite: server actions use the member's or admin's own RLS client for plain CRUD and `security definer` RPCs (execute revoked, granted only where the client needs it) for anything with rules (`record_checkin`, `manual_checkin`, `activate_member_account`); module checks are `club_has_module` / `current_club_has_module` in SQL and `isModuleReady` / `requireModule` in `lib/modules.ts`; admin navigation is a flat list in `app/admin/layout.tsx` filtered by `canAccessPath`; forms use `ActionForm`, dialogs use `TriggerDialog`/`Dialog`, lists use `Table`, `Card`, `Badge`; terms live in `lib/club-type.ts` (TypeScript, per type).
- Modules today: `platform_modules` (global status) plus `club_type_modules`; there are no per-club overrides, and only `member_portal` and `checkin` call `requireModule`/`isModuleReady`. Plans, billing, cash ledger, payroll, promo and schedule pages are not gated by any module.
- Existing `bookings` means a member booked into a class; `locations` are club-wide and labelled "Lokasi Kolam" in the settings UI. Classes are scheduled by hand with free start and end times and an exclusion constraint per instructor.
- No test framework. Verification so far used a local Postgres 16 with stubbed Supabase roles and JWT claims. PostgREST v12.2.3 can be downloaded and runs here (checked), so this task can also be verified end to end with PostgREST, `next start` and the preinstalled Chromium (Playwright), which previously was not possible. This is test tooling only and adds nothing to the repository.
- Visual state: functional but plain (tables and cards, no calendar/grid component, no spacing or colour tokens beyond Tailwind variables in `globals.css`). Phase 3 needs a new calendar component; `ui-ux-pro-max` is the design authority and will be consulted before each UI phase.
- Admin navigation is already 13 items long (it scrolls horizontally on phones). This task adds "Fasilitas", "Booking" and a settings sub-page; grouping the navigation is not part of the request.

## Mismatches and assumptions

1. **Class times vs the slot grid.** Decision 4 says bookings sit on slot boundaries inside opening hours, but classes use free times (for example 15:30 to 16:45). Assumption: grid and opening-hours checks apply to `staff` and `member` bookings only; synced `class` rows keep the class times, and the conflict check is a plain interval overlap.
2. **A class takes one capacity unit**, not the whole facility. On a capacity-1 court it blocks the court; on a 30-person gym floor it takes one place.
3. **Terms as data.** The prompt wants terms to be data ("adding a sport must be data") and also says `lib/club-type.ts` terms gain `resource` and `session`, but terms are a TypeScript map today. Assumption: add `club_types.terms jsonb` (seeded for swimming and gym), `getClubTerms` reads it and falls back to neutral defaults. No per-sport code remains.
4. **Per-club toggles must be honoured by existing pages**, otherwise "disabling hides navigation and blocks pages" is false for plans, billing, cash ledger, payroll, promo, classes and the member portal. Plan: gate those routes with small `layout.tsx` guards and navigation filters. Defaults keep every module enabled, so no existing flow changes. Only `resource_booking` also gets RPC-level blocking, as specified; other modules' RPCs stay as they are.
5. **Overrides can enable a module outside the club's type** (the decision says "type modules + enabled overrides - disabled overrides"): a swimming club may enable `checkin`. Effective modules are always limited to `ready`, and `members` can never be disabled. Overrides are written only through a `security definer` function (`set_club_module`, admin), not directly.
6. **Roles.** `book_resource` for admin and receptionist; coaches get no booking screen but read class-sourced bookings of their own classes; `/admin/fasilitas` and `/admin/settings/modul` are admin only; `/admin/booking` is admin and receptionist; finance sees none. Owner is an admin profile, so the owner toggles modules and manages facilities.
7. **Member self-booking and subscriptions.** "Active subscription (as in check-in)" is applied as: status active, started, not past `end_date` (WIB). A used-up session pack does not block booking, because bookings do not consume sessions (check-ins do).
8. **Timing rules.** Members book only slots starting in the future and within `advance_days`; staff may also book the slot that is running now (it ends in the future). `completed` and `no_show` can be set once the booking has started. Cancelled, completed and no-show rows no longer count against capacity. Class-sourced bookings cannot be cancelled from the booking screens; they follow the class.
9. **Facilities need a location** (`resources.location_id` not null), so onboarding step 1 (locations) comes first and clubs without a location cannot add facilities. Opening hours are stored per weekday in WIB; a booking cannot span midnight; a closing time of 24:00 is allowed.
10. **Onboarding.** Existing clubs are backfilled as completed so they do not get the banner. After "Tambah klub" the owner is switched into the new club (a session is minted for its admin profile) and lands on `/admin/onboarding`, which changes today's behaviour of staying in the current club. Step 2 appears only when the club's effective modules include `resource_booking`. Completing is a `security definer` function because clients cannot update `tenants` columns other than name, logo and colour.
11. **Presets** seed `swimming` (lane, "Lintasan {n}", 4, 60 minutes) and `gym` (floor, "Area Gym {n}", 1, 60 minutes) only; the onboarding offers them as editable suggestions, never creates anything without confirmation.
12. **Calendar.** Day view: one column per facility for the chosen date. Week view: seven day columns for one chosen facility (one column per resource would not fit a week). On 375 px the calendar scrolls inside its own container, never the page.
13. **Error codes.** New prefix `RB001` to `RB008` (full, outside hours or off grid, module off, beyond advance window, too late to cancel, no active subscription, conflict with a class, not allowed). Existing `SW`, `CK`, `MP` codes unchanged.
14. **Words.** Existing screens keep their wording (for example "Lokasi Kolam" and the landing page still say pool/swimming); only new screens use `terms`. Calling it out because a gym or court club will still see "Lokasi Kolam" in settings until that label is moved to terms (a one-line change I will make if you want it in scope).
15. **No payment** for bookings; the price is stored and shown only.
16. **Risk: regressions in existing flows** from the new route guards and the redefined `club_has_module`. Mitigation: defaults enable everything, and the final checks include the swimming and gym flows and a link check.
17. **Risk: no visual review so far** (earlier phases had no browser). With PostgREST available I will drive the real app with Chromium and look at screenshots at 375 px and desktop before calling Phase 3 done; this is verification tooling only.

## Plan

**Migration `20250101000020_modules_onboarding.sql`**
- `tenant_module_overrides(tenant_id, module_code, enabled, changed_by, changed_at)`, RLS select for the club's admin, no direct writes, `members` rejected by check.
- `platform_modules.resource_booking` ("Fasilitas & Booking", `soon` until Phase 2) and `club_type_modules` rows for swimming and gym.
- `club_has_module` redefined as effective modules (type plus enabled overrides minus disabled overrides, `ready` only, `members` always); `current_club_modules()` for the settings page; `set_club_module(module, enabled)` (admin only).
- `tenants.onboarding_completed_at` (existing tenants backfilled), `complete_onboarding()`; `club_types.terms jsonb`; `club_type_presets` with the two seed rows.

**Phase 1 code**: `lib/modules.ts` helper for the effective list, navigation and layout guards for each module, `/admin/settings/modul` (toggle page), `/admin/onboarding` wizard, dashboard banner, post-signup and "Tambah klub" redirects, terms from the database.

**Migration `20250101000021_resource_booking.sql`**
- `resources`, `resource_hours`, `resource_bookings` with RLS (tenant read for staff and members of the club, admin writes for resources and hours, bookings readable by staff, the booking's member, and coaches for their own classes, never writable by clients).
- Triggers: slot grid and opening hours for staff/member rows, capacity with `for update` on the resource row, one-of member/guest/class, tenant consistency; `classes.resource_id` with a sync trigger (insert, move, change facility, delete).
- RPCs `book_resource`, `book_resource_as_member`, `cancel_booking`, `set_booking_status`, and `resource_availability(resource_id, date)` returning only free/busy and remaining places.
- `resource_booking` set to `ready` at the end of the migration.

**Phase 2 server**: actions for resources and hours, staff booking, member booking, cancel and status; data readers; class form gets the optional facility.

**Phase 3 UI**: `/admin/fasilitas`, `/admin/booking` (day and week calendar, click an empty slot to book member or guest, click a booking for cancel/completed/no-show), `/member/booking` (facility, date, slot, then "Booking saya"), facility select in the class form, navigation per module with `terms` labels, checked at 375 px and desktop in a real browser.

**Phase 4**: README and CLAUDE.md, final checks as listed in the task, run once against local Postgres and, for the UI and signed-in flows, PostgREST plus the built app.

## Decisions I need from you (defaults apply if you just say OK)

1. Assumptions 1, 2 and 7 (class rows ignore the grid; a class uses one place; used-up packs do not block booking).
2. Assumption 3 (terms stored in the database).
3. Assumption 4 (route guards added to existing modules).
4. Assumption 10 (owner is switched into the new club after "Tambah klub").
5. Assumption 12 (week view is per facility).
6. Assumption 14: also rename "Lokasi Kolam" to a neutral word through `terms`? Default: yes, one label only.
7. Navigation grouping is left alone; say so if you want it done as part of this work.

## Phase 1 done

- Migration `20250101000020_modules_onboarding.sql`: module `resource_booking` (status `soon` until Phase 2) and its `club_type_modules` rows, `tenant_module_overrides` (admin select only, `members` rejected), `club_has_module` now effective modules, `current_club_modules()`, `set_club_module()` and `complete_onboarding()` (security definer, admin, execute revoked from public/anon), `tenants.onboarding_completed_at` (existing clubs backfilled as completed), `club_types.terms` (swimming and gym, with `resource`, `session`, `location`), `club_type_presets` with the two seed rows. Applied on an empty DB and on 001-019 plus sample rows. Smoke checked in SQL: a swimming club can enable `checkin` and disable `member_portal`, `members` and unknown modules are rejected, a coach cannot toggle and sees the effective answer, the gym club is unaffected, only the club's admin reads overrides.
- Code: `lib/club-type.ts` reads terms from the database (neutral defaults), `lib/modules.ts` (`getClubModules`, `getEnabledModules`), `setClubModule` and `completeOnboarding` actions, `Switch` component, `/admin/settings/modul` (list with switches, "Segera hadir" and "Selalu aktif" badges, settings card linking to it), module route guards (`layout.tsx` for packages, subscriptions, invoices, cash ledger, payroll, promo; schedule layout), navigation and dashboard quick links filtered by module, settings card title uses `terms.location`.
- Onboarding: `/admin/onboarding` (steps: location, first package when `plans` is on, done; each step has Lanjut, Kembali, Lewati semua; step indicator with "Langkah n dari m"), dashboard banner until completed, registration lands on `/admin/onboarding`, "Tambah klub" switches the owner into the new club and lands there. Step 2 (facilities) is added in Phase 2 when the module exists; until then it is hidden, so there is no dead end.
- `ui-ux-pro-max` consulted: switch exposed as a button with `role="switch"` and `aria-checked`, status not by colour alone, onboarding with a step indicator plus skip and back, helpful empty states. Its generated landing-page design system (glassmorphism, hero) did not fit an internal admin app and was not used; existing tokens were kept.
- Not gated by module (unchanged on purpose): coach screens for classes and attendance, reports.

## Phase 2 done

- Migration `20250101000021_resource_booking.sql`: `resources`, `resource_hours`, `resource_bookings` (select-only RLS, no client writes), `classes.resource_id` with a sync trigger, capacity trigger (locks the facility row, max concurrent overlap), RPCs `create_resource`, `set_resource_hours`, `book_resource`, `book_resource_as_member`, `cancel_booking`, `set_booking_status`, `resource_availability` (no names), `resource_booking` set to `ready`. Codes RB001-RB008. Applied on an empty DB and on 001-020 plus sample rows.
- Verified in SQL: 20 parallel bookings of one slot on a capacity-1 court gave 1 success and 19 RB001; capacity-3 lane gave 3 successes and 2 rejections (5 tries); a 2h booking plus two 1h bookings on a capacity-3 lane is accepted and the next overlapping one is rejected (max overlap, not a naive count); off-grid, outside hours, before opening, past, both/neither member and guest rejected; 24:00 closing time gives a 23:00-24:00 slot; a class on a facility blocks the slot, moving the class frees the old slot, deleting it frees it, a facility in another location is rejected; coach and anon cannot book, no client insert/update/delete on `resource_bookings`; a member without an active subscription gets RB006, beyond `advance_days` or in the past RB004, cancel inside `cancel_hours` RB005, another member's booking is forbidden, a member sees only own rows and no guest names, availability marks `mine` only; status `completed`/`no_show` only after start; tenant isolation (other club sees nothing, cannot book, cannot use a foreign location); module off gives RB003 on every RPC while rows stay, `members` cannot be disabled, re-enabling restores booking.
- Server: `lib/booking.ts` (types, labels, `bookingErrorMessage`), `lib/validations/booking.ts`, actions `lib/actions/resources.ts` (create, bulk create for presets, update, active toggle, hours) and `lib/actions/booking.ts` (staff booking, member booking, cancel, status), readers `lib/data/booking.ts` (resources, hours, bookings in range, my bookings, availability, preset, class options), class form gets an optional facility filtered by location (hidden when the module is off or no facilities), `canAccessPath` allows `/admin/booking` for admin and receptionist, onboarding gets a facilities step with preset suggestions (only when the module is effective).

## Phase 3 done

- `ui-ux-pro-max` consulted (no database match for the slot-picker query; fell back to its general rules: 44 px touch targets, status in text not colour only, own scroll container, visible labels, confirm before destructive actions). Existing tokens and components kept.
- `/admin/fasilitas` (admin): table of facilities with Ubah, Jam buka (per-weekday open/close) and Aktifkan/Nonaktifkan, add dialog, empty states that link to settings when no location exists. `/admin/booking` (admin, receptionist): day view (one column per facility) and week view (one facility, seven days), previous/next/today/date picker, click a slot to see its bookings (cancel, mark done, no-show) and create a booking for a member or a guest; class-sourced rows are read-only. `/member/booking`: facility chips, date picker limited to the advance window, slot buttons with remaining places, "Booking saya" with cancel (or the reason it cannot be cancelled) and history. Class form has an optional facility filtered by location. Navigation items are module-gated and the facility label comes from `terms`.
- Fixed while testing: a member could book the same slot twice on a facility with capacity above 1; `book_resource_as_member` now rejects it (RB008) and `resource_availability` no longer marks such a slot as bookable.
- Checked in a real browser (PostgREST + built app + Chromium): onboarding facilities step with preset, 4 lanes created, staff booking through the calendar dialog (slot shows 1/3), week view, facilities page, hours dialog, member booking and cancel, no horizontal page scroll at 375 px on the booking and facilities pages, member redirected away from `/admin`.

## Phase 4 done

- README (modules per club, facilities and booking, error codes, changelog 2026-10-05, out-of-scope wording) and `CLAUDE.md` notes updated.
- Passed: `npm run build`, `npx tsc --noEmit`, `npm run lint`; migrations 001-021 apply on an empty DB and on a DB with sample rows.
- Verified: 20 parallel bookings of one capacity-1 slot gave exactly one success; capacity-3 lane accepted three and rejected the rest; off-grid and outside-hours bookings rejected; class with a facility blocks the slot and moving or deleting it frees it; member rules (no subscription, advance window, cancel window, no other members' names, no double booking of own slot); tenant isolation; no client insert/update/delete on `resource_bookings`; module off gives RB003 on every RPC and 404 on admin and member pages while data stays, re-enable restores it, `members` switch is locked; onboarding finished from the UI removes the banner; navigation links of a swimming admin (17), gym admin (18) and a member (2) all return non-error pages; no horizontal page scroll at 375 px.
- Not verified: dark mode of the new screens, and the booking dialog layout at 375 px was only opened, not reviewed in detail.
