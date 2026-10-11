# gym-checkin progress

Gym check-in by rotating QR; adds the `checkin` module and a selectable `gym` club type.

## Status

- [x] Phase 0: preparation and plan. OK received (defaults accepted).
- [x] Phase 1: database (`018_club_types.sql`, `019_gym_checkin.sql`)
- [x] Phase 2: server
- [x] Phase 3: UI
- [x] Phase 4: cleanup and final checks

## Dependency note

`org-billing` and `member-login` are merged. `club-types` was not: no branch, no pull request, no migration (checked GitHub and the repo). On your instruction ("kamu merge aja, kalo gaada kamu rancang") I design a minimal `club-types` here as the first part of Phase 1 to 3. It is small on purpose so a fuller `club-types` can replace it.

## Phase 0 findings

### What exists

- Modules: `platform_modules(code, status ready|soon)` is global; `requireModule` / `isModuleReady` (`lib/modules.ts`) read that global status; `activate_member_account` checks it in SQL. `checkin` is `soon`, `member_portal` is `ready`. There is no club type and no per-club module setting.
- Member side: `member_accounts`, profiles with role `member`, `is_member()`, `current_member_id()`, `switchClub`, `listMemberClubs`, `createSession` (JWT with optional `club_pending`), `/member` pages, `my_subscription_usage` and `subscription_usage` (session packs counted from attended bookings), `subscriptions` unique active per member.
- Rate limit: `isRateLimited(request, scope, limit, window)` keys by IP over `hit_rate_limit` (service role only); no per-profile variant yet.
- Admin shell: `app/admin/layout.tsx` nav list filtered by `canAccessPath`; `recharts` is already installed (used by `components/reports`). No QR library.
- `profiles`, `members`, `subscriptions`, `membership_packages` (session packs: `sessions_included`, `validity_weeks`), `pgcrypto` is installed (`hmac`, `gen_random_bytes`).

### Plan

**Migration `20250101000018_club_types.sql` (minimal club-types)**
- `club_types(code pk, name, status ready|soon, sort)`, seeded `swimming` (ready), `gym` (soon). `club_type_modules(club_type, module_code)`: swimming and gym both get members, plans, billing, cash_ledger, classes, payroll, promo, member_portal; gym additionally gets `checkin` (row exists from now, usable only when the module is `ready`).
- `tenants.club_type text not null default 'swimming'` (existing rows become swimming).
- `club_has_module(tenant, module)` (security definer, server only) = the module is in the club's type list and `platform_modules.status = 'ready'`; `current_club_has_module(module)` for the signed-in club (granted to authenticated). `activate_member_account` is redefined to use the per-club check (error MP003 unchanged).
- `register_organization(..., p_club_type default 'swimming')` and `create_tenant_for_owner(owner, name, p_club_type default 'swimming')` recreated; both reject a type whose status is not `ready`. `club_types` readable by anon and authenticated.

**Migration `20250101000019_gym_checkin.sql`**
- `checkin_points(id, tenant_id, location_id null, name, secret default random 32 bytes hex, is_active, created_at)`: column privileges so clients can select and write everything except `secret`; admin-only RLS in the tenant; `unique (tenant_id, name)`.
- `checkins(id, tenant_id, member_id, point_id null, checked_in_at default now(), method qr|manual, subscription_id null, created_by null)`; indexes on (tenant, time) and (member, time). RLS select only: admin all in tenant, receptionist and head coach all in tenant, coach through `coach_owns_member`, member own rows. No insert, update or delete for any client role; the table grants are narrowed too.
- Token scheme: `window = floor(epoch / 30)`; `token = first 12 hex of HMAC-SHA256(secret, point_id || ':' || window)`. `checkin_token(point_id)`: admin only, returns the current window's token. Accepted windows: current and previous, so a token lives 30 to 60 seconds.
- `record_checkin(point_id, token)` (security definer, called with the member's JWT, granted to authenticated). Order: caller must be a member (otherwise forbidden) → point active and in the caller's club, token valid for current or previous window, else `CK005` → module on for the club, else `CK001` → member row active, else `CK002` → advisory lock per member, then if a check-in exists in the last 120 minutes return it (`already = true`, no new row) → active subscription (active, started, not past `end_date` in WIB), else `CK003` → session pack not used up (check-ins counted), else `CK004` → insert. Errors map to Indonesian messages: CK001 "Check-in belum tersedia di klub ini", CK002 "Keanggotaan Anda tidak aktif", CK003 "Anda belum punya paket aktif", CK004 "Sesi paket Anda sudah habis", CK005 "Kode QR tidak valid atau sudah kedaluwarsa, pindai ulang".
- `manual_checkin(member_id, point_id null)`: admin, or coach for their own member; same module, member, 120-minute and subscription rules; method `manual`, `created_by` = caller.
- `subscription_usage` and `my_subscription_usage` recreated: for a club with the `checkin` module, `sessions_used` = check-ins of that subscription; otherwise attended bookings as before.
- Reporting views (security invoker): `checkin_daily_counts` (visits today and this week in WIB), `checkin_hourly_30d` (24-hour histogram of the last 30 days), `dormant_members` (active plan, no check-in for 14 days, or never).
- `platform_modules.checkin` and `club_types.gym` set to `ready`.

**Server**
- `lib/modules.ts` switches to the per-club check (`current_club_has_module`); `requireModule` / `isModuleReady` keep their names.
- `lib/club-type.ts`: `terms` per club type (swimming: Anggota, Pelatih, Kelas; gym: Member, Personal Trainer, Sesi) used by the new check-in screens only; existing screens are not retrofitted.
- `isKeyRateLimited(key, limit, window)` in `lib/auth/rate-limit.ts` (the IP helper reuses it); scans limited to 10 per minute per profile.
- Actions (`lib/actions/checkin.ts`, `ActionState`): create, rename and deactivate points, `fetchCheckinToken(pointId)` (admin), `manualCheckin` (admin or coach).
- Scan route `GET /checkin?p=&t=` (route handler): validates input; no session → `/login?next=<the scan URL>` (only a safe internal path is accepted); `requireRole('member')`; finds the point's club with the service role; if the session is in another club or pending, looks the club up in the account's memberships and re-mints the JWT (same as `switchClub`), otherwise shows "Anda bukan anggota klub ini"; rate limit; calls `record_checkin` with the member's token; redirects to `/checkin/hasil` with a result code.
- `createSession` returns the signed token so the scan can use the new club's JWT in the same request.
- Create club flows accept the club type (wizard and "Tambah klub").

**UI (Phase 3; `ui-ux-pro-max` first, existing components only, ask before a new visual style)**
- `/admin/checkin`: today's check-ins (member, WIB time, plan), points management, "Tampilkan QR", manual check-in dialog, visits today and this week, 24-hour histogram (recharts, like the reports), dormant members. `/admin/checkin/layar/[pointId]`: full-screen QR, token refreshed every 20 seconds, QR drawn client-side with `qrcode-generator` (zero dependencies).
- `/checkin/hasil`: clear success or failure screen. `/member/kunjungan`: history and visits this month. Admin member detail: "Kunjungan" section. Coach's member list: manual check-in button. Nav item "Check-in" only for clubs with the module. Club type select in `/daftar` step 2 and the "Tambah klub" dialog.

### Decisions I need from you (defaults apply if you just say OK)

1. **Minimal club-types designed here** as above. Club type is chosen when a club is created and is not editable afterwards (database only).
2. **Swimming clubs do not get `checkin`**; only gym does. `member_portal` stays in both so member login keeps working.
3. **Check-ins replace attended bookings as the session counter** for clubs with the module, so a gym that also marks attendance on bookings no longer counts those toward a pack.
4. **`GET /checkin` records the check-in** (a scan is a navigation). A forged link is harmless without a valid 60-second token for a real point, and scans are rate limited.
5. **Read access to check-ins** also for receptionist and head coach (they already see all members); finance does not. Manual check-in is limited to admin and coach, as specified; receptionist can be added later.
6. **After a first login with a temporary password** the member is sent to change it and must scan again.
7. **New dependency `qrcode-generator`** for the QR (about 20 KB, no dependencies).
8. **Admin screen access:** `/admin/checkin` is admin-only by default; receptionist could run the front desk, tell me if you want it.
9. **The "visits tab"** on member detail is a "Kunjungan" section below the form, not a tab, to avoid a tab system inside the intercepting modal.
10. **Token is 12 hex characters** (48 bits); with 60 seconds of validity and 10 scans per minute per profile, guessing is not practical.

## Phase 1 done

- `20250101000018_club_types.sql`: `club_types`, `club_type_modules`, `tenants.club_type`, `club_has_module` (server only) and `current_club_has_module`, `activate_member_account` now per-club, `register_organization(..., p_club_type)`, `create_tenant_for_owner(owner, name, p_club_type)`, `create_tenant_row` (a type that is not `ready` is rejected).
- `20250101000019_gym_checkin.sql`: `checkin_points` (column privileges hide `secret`), `checkins` (select policies only), token helpers, `checkin_token` (admin), `checkin_core`, `record_checkin`, `manual_checkin`, `subscription_usage` / `my_subscription_usage` count check-ins for clubs with the module, views `checkin_daily_counts`, `checkin_hourly_30d`, `dormant_members`, `checkin` and `gym` set to `ready`. Error codes CK001 to CK005 carry the Indonesian messages.
- Applied on an empty DB and on 001-017 plus sample rows. Smoke checked in SQL: gym club has `checkin`, swimming does not, unknown club type rejected; admin token works, coach is forbidden; one scan makes one row and a repeat returns the existing one; tokens of window -2, of another point, forged, and of another club are rejected (CK005); no plan CK003, used-up pack CK004, inactive member CK002, club without the module CK001; clients cannot insert into `checkins` nor read `checkin_points.secret`; staff calling `record_checkin` is forbidden; coach sees only own members' check-ins, member only own; pack usage 1/1/0 from check-ins; 20 parallel scans of one member gave exactly one new row.

## Phase 2 done

- `lib/modules.ts` now checks the module per club (`current_club_has_module`); `lib/club-type.ts` (`termsFor`, `getClubTerms`, `getReadyClubTypes`); `lib/checkin.ts` (error codes and result messages); `isKeyRateLimited` (the IP helper reuses it); `createSession` returns the signed token; `createSupabaseClientWithToken`.
- `lib/actions/checkin.ts`: `createCheckinPoint`, `renameCheckinPoint`, `setCheckinPointActive`, `fetchCheckinToken` (admin), `manualCheckin` (admin or coach); all gated by the club's `checkin` module where it matters.
- Scan route `app/checkin/route.ts` (`GET /checkin?p=&t=`): validates input; no session redirects to `/login?next=<scan URL>`; staff get a message; looks up the point's club, switches to it through the account's memberships (or "Anda bukan anggota klub ini"); 10 scans per minute per profile; calls `record_checkin` with the member's own JWT; redirects to `/checkin/hasil` with a result code.
- Login accepts only a safe internal `next` path (`lib/auth/next-path.ts`), used by the login page and form. Club type accepted by registration and `createTenant`; the UI selector comes in Phase 3.

## Phase 3 done

- `ui-ux-pro-max` consulted (clear success/failure feedback; icon plus text, not colour alone). Existing components only; the new dependency is `qrcode-generator`.
- `/admin/checkin` (module and admin gated): visits today / this week, points management (create, rename, activate, "Tampilkan QR"), manual check-in dialog, today's table (member, WIB time, point, plan, method), 24-hour histogram of the last 30 days (recharts), members with an active plan and no visit in 14 days. `/admin/checkin/layar/[pointId]`: full-screen QR redrawn client-side every 20 seconds. Nav item "Check-in" only for clubs with the module.
- `/checkin/hasil`: success or failure screen with icon and message; `/member/kunjungan` plus nav item for the member; "Kunjungan" section on the admin member detail and modal; manual check-in button on the coach's member list.
- Club type select in the `/daftar` wizard step 2 and in the "Tambah klub" dialog (shown only when more than one type is ready). New screens use `terms` from the club type; existing screens keep their wording.

## Phase 4 done

- README (club types and modules, token scheme, privacy, limits, changelog) and `CLAUDE.md` notes updated.
- Passed: `npm run build`, `npx tsc --noEmit`, `npm run lint`; migrations 018 and 019 apply on an empty DB and on 001-017 plus sample rows.
- Verified in SQL (local Postgres with stubbed Supabase roles and JWT claims): a valid scan creates one row (member, point, time, subscription); the same scan again returns the existing row; tokens of window -2, of another point, forged, and of another club are rejected (CK005); no plan CK003, used-up pack CK004, inactive member CK002, club without the module CK001; a member of club A cannot check in at club B's point; a coach reads only own members' check-ins, a member only its own; a client cannot insert into `checkins` nor read `checkin_points.secret`; staff cannot call `record_checkin`; 20 parallel scans of one member produced exactly one new row (19 returned the existing one); pack usage counted from check-ins (1/1/0); gym club has `checkin`, swimming does not; unknown club type rejected.
- Verified against the built app (`next start`, dummy env): an unsigned `GET /checkin?p=&t=` redirects to `/login?next=/checkin?p=...&t=...`; malformed input goes to the failure screen; the result page and `/admin/checkin` redirect to `/login`; `safeNextPath` accepts internal paths and rejects `//host`, `https://`, backslash, `javascript:` and control characters.
- Not executed: the signed-in half of the flow (login then return to the scan, the club switch inside the scan, the rate limit, `record_checkin` through PostgREST, the QR screen refresh in a browser) because there is no PostgREST or browser against a database here.
