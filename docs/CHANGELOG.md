# Changelog

## 2026-10-11

- Every account has a username (3–30 characters, lowercase letters, digits, dot, underscore). Owners, staff and member accounts share one namespace; superadmins have their own. Existing accounts get one from their email (migration 033).
- `/login` and `/superadmin/login` take "Username atau email" with one generic error; lockout and rate limits are unchanged.
- Registration, staff, coach and member activation forms ask for a username, filled from the email until edited.
- New profile pages (`/profile`, `/superadmin/profile`) show account details and let each account edit its own name, username and phone (members: username only), with an audit entry per change. Coaches see their certifications and a hidden-by-default session rate.
- The key icon in the top bar is replaced by a profile link; changing the password now lives on the profile page, and `/change-password` remains for the forced first-login change.

## 2026-10-10

- Signed-in pages restyled to a framed card layout: hatched card frames with the title on the frame and the content in an inner body, page headers with breadcrumbs, metric cards, framed table cards with filters in the header, and rounded-top bar charts.
- Full-height sidebar with a brand row, compact 32 px controls on desktop and 44 px controls on phones; motion uses shared durations that drop to zero under reduced motion. Colors, fonts, routes and permissions are unchanged.

## 2026-10-10

- Sign-out and password changes end every session of the account; platform admins sign in with an authenticator app and recovery codes.
- Invoices, payroll and order cancellations change only through database functions, with reasons and linked reversal entries; expired trials and pending organizations keep read access only.
- Paginated lists and faster row policies; club registration verifies the owner's email and a captcha when those services are configured.
- Audit log, consent records, member data export and anonymisation, and stricter promo image checks.
- Booking rules for started classes and members without an active package (admins can record late attendance), matching length and date limits in forms and database, and phone layout, contrast and touch target fixes.

## 2026-10-09

- Migration 019 no longer depends on where `pgcrypto` is installed, so the migrations apply on the hosted layout (`pgcrypto` in `extensions`) and on a plain local one.
- Migration 024 aligns database privileges: no `TRUNCATE`, `REFERENCES` or `TRIGGER` for client roles, function execute limited to signed-in users and the service role, a fixed `search_path` on every function, and the retired plan tables closed to client roles.
- The invoice cron route now requires `CRON_SECRET` to be set and compares it in constant time.
- `docs/DEPLOY.md` updated with the apply steps, mandatory env vars and a smoke test.

## 2026-10-08

- Landing page reworked for all sports: sports list from `club_types`, features by job, how it works, multi club, pricing copy from live plans, FAQ and final call to action; all fake figures and demo club names removed.
- Every landing claim is listed with its proof in `progress/landing-rework-progress.md`; product visuals use sample data labelled "Contoh data".
- Sitemap, robots, Open Graph image, canonical URL and JSON-LD; draft `/privasi` and `/syarat` pages (`noindex`); optional contact via `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_CONTACT_WHATSAPP`.
- Pricing hint now lists all internal user roles (owner, admin, coach, receptionist, finance).

## 2026-10-07

- Navigation grouped into labelled sections (Organisasi, Utama, Orang, Operasional, Penjualan, Keuangan, Lainnya) with line icons; same routes, roles and module filters.
- Phones get a bottom tab bar with a full-screen "Menu" sheet instead of a horizontal scroll strip; the bar respects the iOS safe area.

## 2026-10-06

- Products, orders and a cashier with split manual payments, printable receipt, stock handling that cannot oversell, and cash ledger entries per payment (migration `20250101000022_commerce.sql`, module `pos`, codes `PS001` to `PS006`).
- Sport club types as data: tennis, padel, pilates and yoga are ready, seven more are listed as coming soon, with terms, modules and facility presets in tables (migration `20250101000023_sport_club_types.sql`).
- Dashboard cards for bookings today, facility occupancy this week and sales today; onboarding suggests facility capacity from the preset.

## 2026-10-05

- Per-club module toggles (`/admin/settings/modul`), terms stored per club type, and a skippable onboarding wizard with a dashboard banner.
- Generic facilities and booking engine: `resources`, `resource_hours`, `resource_bookings`, capacity by locked max-overlap, class sync, RPCs and error codes `RB001` to `RB008` (migrations `20250101000020_modules_onboarding.sql` and `20250101000021_resource_booking.sql`).
- Admin `/admin/fasilitas` and `/admin/booking` (day and week calendar), member `/member/booking`, optional facility on classes.

## 2026-10-04

- Gym check-in: rotating QR (30-second windows, 60 seconds of validity), `/checkin` scan route, `record_checkin` with codes `CK001` to `CK005`, 120-minute duplicate rule, manual check-in, session packs counted from check-ins.
- Admin `/admin/checkin` (today, points, full-screen QR, hour histogram, members with no visit in 14 days); member `/member/kunjungan` and a result screen.
- Minimal club types (`swimming`, `gym`) with per-club modules (migrations `20250101000018_club_types.sql` and `20250101000019_gym_checkin.sql`).

## 2026-10-03

- Members can sign in on `/login` (read-only `/member`: subscription and remaining sessions, invoices, upcoming classes, promo); one account can belong to many clubs, with `/member/klub` and `switchClub`.
- Admins and coaches activate accounts from the member ("Aktifkan akun") and reset temporary passwords; gated by the `member_portal` module (now `ready`).
- One email is one kind of identity across owners, coaches/staff and members (migration `20250101000017_member_login.sql`).

## 2026-10-02

- Billing moved from club to organization: Standard and Advanced plans priced per internal user (monthly or yearly), `organization_subscriptions`, `platform_quote`.
- Member and location limits removed (`SW001`/`SW002`); `SW003` now gates pending, suspended and expired-trial organizations; `SW004` uses the plan club limit.
- New landing pricing, `/daftar` wizard, `/admin/klub/langganan`, price-change confirmation when adding a coach, superadmin plan and subscription editors (migration `...014_org_billing.sql`).

## 2026-10-01

- Organizations own many clubs (`max_tenants`, `SW004`); one `/login` for owner, admin and coach; owner club list and switcher.
- Parent and child accounts removed: `members` with `coach_id` and contact fields; coaches see only their own members.
- Migrations `20250101000012_organizations.sql` and `20250101000013_members.sql`; superadmin portal grouped by organization.

## 2026-09-26

- Platform billing: `superadmins`, `platform_plans`, `platform_subscriptions`,
  `platform_tenant_usage` (migration `20250101000010_platform_billing.sql`),
  `/superadmin` portal, `npm run seed:superadmin`.
- Plan member and location limits enforced in the database.
- Suspended/cancelled clubs lose access immediately, including live
  sessions; `tenants` is now column-restricted for club admins.
- Self-service club signup at `/daftar` with a 14-day trial.
- Landing page pricing section and admin trial banner, both reading
  `platform_plans`.
- Deactivated/suspended sessions are cleared through
  `/api/auth/session-ended` (cookies can't be deleted during Server
  Component render).

## 2026-09-22

- Added `frontend-design`, `bencium-innovative-ux-designer`, `design-audit`
  skills under `.claude/skills/`.
- Admin dashboard (`/admin`) now shows live KPIs, overdue/expiring alerts,
  today's classes, recent cash entries, and quick actions (was a static
  welcome card).
- Search/filter added to the members, coaches, schedule, subscriptions, and
  invoices list pages.
- New session-pack billing mode (N sessions / X weeks) alongside the
  existing recurring `billing_cycle` packages — additive migration
  `20250101000009_session_packages.sql`, a `subscription_usage` view, and a
  fix to `generate_invoices_for_period` so it never double-bills
  session-pack subscribers.
- Light/dark theme (`next-themes`).
- Add/manage flows switched from dedicated pages and always-visible inline
  forms to dialogs (native `<dialog>`, Next.js intercepting routes for
  members/coaches/schedule).
- Public marketing landing page at `/` (hero, features, how-it-works,
  multi-tenant section, dashboard preview, CTA, footer); an authenticated
  session still redirects straight to its role home, and `/login` is
  unchanged.
