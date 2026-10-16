# 27 Club: architecture and feature notes

## System overview

One Next.js app (App Router, React 19, Tailwind v4) on Vercel and one
Supabase project (Postgres) serve every club. There is no Supabase Auth and no
client-side data layer (Supabase Storage holds only promo images): pages are server
components that read through a per-request, JWT-bound Supabase client, and
writes are server actions that call tables or SQL functions under RLS.

```text
Browser ── proxy.ts (CSP nonce, session check, role gate via canAccessPath)
   │
   ▼
Next.js server (pages, server actions, route handlers)
   │  own HS256 JWT (httpOnly cookie)           service role: narrow, reviewed uses
   ▼                                                      │
Supabase Postgres (RLS, security definer RPCs, triggers) ◀┘
   ▲
   ├── Vercel Cron  /api/cron/generate-invoices  (monthly)
   │                /api/cron/subscriptions      (daily: expire, reminders)
   ├── Midtrans Snap + notification  /api/payments/midtrans
   └── Resend (email) and Cloudflare Turnstile (captcha), each optional
```

Portals: public (`/`, `/olahraga/<code>`, `/daftar`, `/login`, `/privasi`,
`/syarat`), admin (`/admin`: admin, receptionist, finance and head coach, each limited by `canAccessPath`), coach (`/coach`), member (`/member`, read-only plus booking), and the
platform superadmin (`/superadmin`, separate session). Folders: `app/` routes
and server actions entry points, `lib/actions` server actions, `lib/data`
reads, `lib/auth` session, roles and JWT, `lib/validations` zod schemas
(mirrored by `CHECK` constraints), `components/` per feature plus `ui/` and
`shared/`, `supabase/migrations` (001 to 038, applied in order), `scripts/`
seed and test helpers.

Cross-cutting rules: all times in WIB through `lib/format.ts`; money and
prices only computed in SQL or on the server; `security definer` functions
are revoked from `public, anon, authenticated` unless a client calls them;
`audit_log` is append-only. Styling, loading and caching are in "Look,
loading and caching" below.

## Multi-tenancy model

Hierarchy: **organization (owner account) → tenants (clubs) → coaches →
members**. An organization (`organizations`) has one or more owners
(`org_owners`) and as many clubs as its plan allows (Standard 3 unless a
superadmin sets `club_limit_override`, Advanced unlimited; trigger error
`SW004`).

Every club is a row in `tenants` with a mandatory `organization_id`. All
club-owned data (profiles, locations, class types, members, classes, bookings, packages, subscriptions, invoices,
cash ledger, payroll, promo) carries a `tenant_id` and is isolated by
Postgres Row Level Security — the database, not the frontend, is the
isolation boundary. `current_tenant_id()` reads the tenant id embedded in the
caller's session JWT, and every RLS policy filters by it; cross-tenant
foreign key references (e.g. a booking's member and class must belong to the
same tenant) are additionally rejected by trigger checks at write time.

A profile belongs to exactly one tenant with one role (`admin` or `coach`).
Each member has one primary coach (`members.coach_id`, same tenant, role
coach) plus plain-text `contact_name` / `contact_phone`. Coaches see only
their own members and classes. An email is unique across owners and coach
profiles (database-enforced), so a coach belongs to one club only. A club's own name, logo, and primary color live in
`tenants` and are edited from Admin -> Pengaturan; they are not environment
variables.

## Auth model

Authentication is **custom**, not Supabase Auth. Every person has one
universal account in `accounts` (email, username, bcrypt hash, lockout,
`sessions_valid_after`, `must_change_password`); it is the only place a password
lives. `org_owners`, `member_accounts` and club `profiles` link to it through
`account_id` (a profile is unique per account and club, and the link can only be
set by the server). There is one `/login` (username or email + password, no club
code): the server finds the account, with the same generic error for unknown
account and wrong password, plus per-IP rate limit and a 15-minute lockout after
5 failures, then picks the context: owner, member (club chooser when several),
club staff, or **personal** when the account has none of them. It mints its own
JWT signed with the Supabase project's JWT secret, carrying `sub` (club profile
id, or the account id for personal), `account_id`, `ctx` (`personal`, `member`,
`org`), `tenant_id`, `org_id` and `app_role` (admin, coach, ..., or `personal`).
A session without `account_id` is rejected.

Organization membership lives in `organization_members` (formerly
`org_owners`): one row per account and organization with a `base_role`:
`p_owner` (exactly one per organization, enforced by a deferred constraint
trigger; ownership moves by demoting the old row before promoting the new one in
one transaction), `owner`, or `staff`. Staff are limited to the clubs listed in
`organization_member_clubs` (an empty list means no club). One account can be
p_owner of several organizations, each with its own subscription. After login
the server lists the account's contexts (`lib/auth/contexts.ts`: one entry per
organization, per member club and per staff profile): one entry opens it
directly, several open the personal page `/akun`, which lists them ("Masuk
sebagai"). `switchContext` (`lib/actions/context.ts`) mints a new JWT for the
chosen entry or for `personal`; the header button "Akun saya" goes back to
`/akun`. The older club switchers still move between clubs of one context.

### Roles and permissions

Authorization is permission based; no policy, SQL function or page checks a role
name. `permissions` is a fixed catalog (about 55 codes such as `members.view_all`,
`pos.sell`, `payroll.manage`; `lib/auth/permissions.ts` mirrors it) and each
organization has its own roles (`organization_roles`, `role_permissions`), seeded
from `role_presets` (Admin, Resepsionis, Keuangan, Kepala Pelatih, Pelatih,
Kasir) when the organization is created and editable by the owner at
`/admin/peran`. A profile has `role` `owner` (p_owner and owner base roles hold
every permission), `staff` (one organization role in `org_role_id`) or `member`.
Owner-only permissions (`roles.manage`) can never be put in a role. Permissions
are not in the JWT: `has_permission(code)` in SQL and `profile_permissions()` for
the server read them live, so a role change, a deactivation or a removed club
assignment applies on the next request.

A role is paid or free. A paid role (Admin, Resepsionis, Keuangan by default) needs
an active `organization_members` row with base role `staff` and an
`organization_member_clubs` assignment for the club (enforced by a trigger and
by `has_permission`), and that membership is the seat. Free roles (Pelatih,
Kepala Pelatih, Kasir) are frontend roles and use no seat. A coach is a staff
profile whose role holds `classes.instruct` (view `instructors`); it needs no
`members` row. `lib/accounts/staff-seat.ts` keeps memberships in step when staff
are created, deactivated or change role.

Pages: the proxy only separates contexts (`canAccessPath`); each page and action
calls `requirePermission` / `requireActionPermission` (`lib/auth/guard.ts`), the
admin `template.tsx` checks the path against `adminPathAllowed`, and the menu is
filtered with the same rules. Where a user lands after login comes from
`staffHome(permissions)`.

The **personal** context has no `tenant_id`, so every club policy returns zero
rows for it (`supabase/tests/accounts_phase1.sql` checks every RLS table). It
lands on `/akun` (profile, change password). Anyone can create an account at
`/daftar/akun` (free, no email verification, terms consent recorded as subject
type `account`). A club can attach an existing account as a member only if the
account's email is verified or it is already a member somewhere; staff accounts
are always created fresh. Registering a club creates the account first, then
`register_organization(..., p_account_id, ...)`.

An owner has no tenant-specific password: each owner gets one `admin`
profile per club (`profiles.owner_id`) and signs in as the profile of their
default club, landing on `/admin/klub` (club list with member and coach
counts, "Tambah klub"). The tenant switcher re-mints the JWT for the owner's
admin profile in another club after checking `owner_id` in the database, with
no second password prompt. The owner is not an RLS role: RLS still sees a
tenant `admin`. Deactivating an owner (`org_owners.is_active`) removes access
to all their clubs at once; changing the owner password revokes every
owner session (`sessions_valid_after`). Coaches go to `/coach`.
`/superadmin/login` stays a separate URL with its own isolated session.

**Members** (swimmers) can sign in too, read-only, once a club has activated
their account (module `member_portal`). One person has one account in
`member_accounts`; each club membership is a `profiles` row with role
`member` (`profiles.member_account_id`) linked from `members.profile_id`.
After login, one club goes to `/member`; several go to `/member/klub` to
choose (the session carries `club_pending` until they do, so no club data is
shown first), and `switchClub` re-mints the JWT after checking
`member_account_id` in the database. RLS for role `member` only selects the
member's own `members`, `subscriptions`, `invoices` and `bookings` rows plus
the tenant-wide classes and active promo; there is no write policy, and
deactivating the member account cuts every club while deactivating the
`members` row cuts only that club. Logout, password change and reset set
`accounts.sessions_valid_after`, which cuts every context of the account (checked
in `checkSession` and in `is_active_user()`).

**Identity rule:** one email is one kind of identity (owner, coach/staff
admin, or member account), enforced by triggers on all three stores. A coach
or owner therefore cannot also be a member with the same email. One account
has at most one member profile per club (a parent using one email for two
children in the same club cannot activate both). That JWT is stored in an
httpOnly cookie and attached as the `Authorization` header on every Supabase
request, so Postgres RLS (`auth.uid()`, `auth.jwt()`) enforces both role and
tenant scoping exactly as it would with Supabase Auth.

**Before running migrations against a real project**, check Project
Settings → API → JWT Keys. This setup requires the legacy shared **HS256
JWT secret** to be available (`SUPABASE_JWT_SECRET`). If a project only has
asymmetric JWT signing keys enabled and no legacy secret, self-minted HS256
tokens won't validate against PostgREST — in that case use Supabase's
Third-Party Auth (JWKS) support instead of `lib/auth/jwt.ts` as written.

The service-role key is used only in a few narrow, reviewed places (never in
client-reachable code): login lookup, owner reads of `org_owners` and the
organization overview, creating a coach account together with its
credentials row, the `register_organization` / `create_tenant_for_owner`
functions (execute granted to `service_role` only), the monthly invoice-generation cron and
its "generate now" admin button. Every other read/write goes through the
per-request JWT-bound client, so RLS is the real security boundary. Every
service-role write to a tenant-scoped table passes `tenant_id` explicitly
(the service-role client has no session JWT for `current_tenant_id()` to
read).

Deactivating an account (`profiles.is_active = false`) cuts off all DB
access immediately, even though its JWT technically hasn't expired — this is
enforced inside the `is_admin()` / `is_coach()` SQL helper
functions, not just in individual policies.

## Onboarding a new club

Because isolation is enforced at the database level (RLS + `tenant_id`),
new clubs are onboarded onto the **same** deployment and Supabase project —
no new Supabase project or Vercel deployment needed. Two ways in:

- **Self-service** (`/daftar`): enter club name and your own
  name/email/password. One database call (`register_organization`) creates
  the organization, subscription (chosen plan and period; both plans start a
  14-day `trial` with 1 seat), owner, first club and owner
  admin profile, so nothing is left half-created. The owner lands on
  `/admin/klub`.
- **More clubs**: the owner adds clubs from `/admin/klub` ("Tambah klub",
  `create_tenant_for_owner`), within the plan's club limit.
- **Manual** (`npm run seed:admin` with `SEED_TENANT_NAME` and optionally
  `SEED_ORGANIZATION_NAME`) uses the same function.
- **Member accounts**: an admin (or a coach for their own members) opens a
  member and uses "Aktifkan akun" with the member's email
  (`activate_member_account`). A new email creates the account with a
  temporary password shown once (`must_change_password`); an email that
  already has an account is linked to the new club without touching its
  password ("Akun sudah ada, anggota login dengan kata sandinya"). Known
  limits: this reveals that the email already has an account; a temporary
  password known to one club's staff stays valid until the person's first
  login; "Atur ulang kata sandi" is refused when the account also belongs to
  another club. Staff and coaches are not created this way any more; see
  "Invitations and password reset" below.

Organizations that existed before the billing migration were backfilled
(see migration `20250101000014_org_billing.sql`): Advanced if any old plan was
unlimited, otherwise Standard, with the highest old status; organizations
without any old subscription became Advanced + active. The owner then sets club name/logo/color from Admin -> Pengaturan.

## Club types, modules and gym check-in

Every club has a type (`tenants.club_type`, chosen when the club is created
in `/daftar` or "Tambah klub"; `swimming` and `gym` are ready). A type lists
its modules in `club_type_modules`; a club has a module when its type lists
it and `platform_modules.status` is `ready` (`current_club_has_module`).
`requireModule` and the module checks in actions and in SQL use that
per-club answer. The `terms` helper (`lib/club-type.ts`) gives the wording
per type for the check-in screens only; older screens keep their wording.

**Gym check-in** (module `checkin`, gym clubs): staff create check-in points
under `/admin/checkin` and open `/admin/checkin/layar/<id>` full screen at the
entrance. The screen redraws a QR every 20 seconds pointing at
`/checkin?p=<point>&t=<token>`. Token scheme: `window = floor(epoch / 30)`,
`token` = first 12 hex characters of HMAC-SHA256(point secret, point id +
`:` + window); a scan accepts the current and the previous window, so a token
lives 30 to 60 seconds and a photo of the QR is useless afterwards. The
secret never leaves the database (column privileges hide it from clients;
only the admin-only `checkin_token()` returns a token).

A member scans with the phone camera. Not signed in: `/login` with a safe
internal `next` path, then back to the scan. If the point belongs to another
club of the same account the session is switched to it; if the account is not
a member there the result says "Anda bukan anggota klub ini". `record_checkin`
runs with the member's own JWT and rejects: invalid or old token or another
club's point (`CK005`), module off (`CK001`), inactive member (`CK002`), no
active plan (`CK003`), session pack used up (`CK004`). A second scan within
120 minutes returns the existing check-in (a per-member lock makes parallel
scans create one row). For clubs with the module, each check-in counts as one
session of a session pack (`subscription_usage` and `my_subscription_usage`
count check-ins instead of attended bookings). Staff can also record a manual
check-in (admin, or a coach for their own members) with the same rules.

Privacy: a check-in stores only member, point, time, plan and method
(`qr` or `manual`, plus who for manual). No IP and no device data. Scans are
limited to 10 per minute per profile. Clients cannot insert into `checkins`;
admin, receptionist and head coach read all of the club's check-ins, coaches
only their own members', members only their own.

## Modules per club, facilities and booking

A club's modules are its type's modules plus enabled overrides minus disabled
overrides, limited to `ready` ones (`tenant_module_overrides`,
`club_has_module`, `current_club_modules()`). The admin toggles them in
`/admin/settings/modul` (`set_club_module`); `members` can never be disabled.
Disabling hides navigation and returns 404 for the module's pages; data stays
and comes back when it is enabled again. Terms (`club_types.terms`, merged
with neutral defaults in `lib/club-type.ts`) hold the wording per type
(`resource`, `session`, `location`, ...), so a new sport is data only.

**Facilities and booking** (module `resource_booking`, swimming and gym
types): a facility (`resources`: court, lane, studio, room, floor) belongs to
a location and has capacity per slot, slot length, price per slot, booking
window (`advance_days`), cancel limit (`cancel_hours`) and opening hours per
weekday in WIB (`resource_hours`, 0 = Sunday). Bookings (`resource_bookings`)
are written only through security definer functions (`book_resource` for
admin and receptionist, `book_resource_as_member`, `cancel_booking`,
`set_booking_status`); clients have select-only policies, members see only
their own rows and `resource_availability` never returns names. Capacity is
enforced by a trigger that locks the facility row and checks the highest
number of overlapping bookings, so parallel requests cannot oversell a slot.
Staff and member bookings must sit on the slot grid inside opening hours and
not cross midnight. A class can use a facility (`classes.resource_id`): it is
mirrored as a booking row that takes one place and follows the class when it
moves or is deleted. Members book only with an active subscription (as in
check-in), only future slots within `advance_days`, and cancel until
`cancel_hours` before the start. The price is stored and shown; there is no
payment. Error codes: `RB001` slot full, `RB002` outside hours or off grid,
`RB003` module off, `RB004` time window, `RB005` too late to cancel, `RB006`
no active subscription, `RB007` conflicts with a class, `RB008` invalid or
not allowed.

Screens: `/admin/fasilitas` (admin), `/admin/booking` (admin, receptionist;
day and week calendar, click a slot), `/member/booking`. A new club lands on
`/admin/onboarding` (location, facilities, first package), every step can be
skipped, and a banner stays on the dashboard until it is finished
(`tenants.onboarding_completed_at`, `complete_onboarding()`).

## Products, orders and point of sale

Module `pos` ("Produk & Kasir"). Products (`products`: price, optional SKU and
category, optional stock tracking) are managed by the admin in
`/admin/produk`. Admin and receptionist sell in `/admin/kasir` (optional
member or customer name, product lines, a member's unpaid priced bookings,
split payment, printable receipt); finance reads orders in `/admin/pesanan`;
a coach has no access; a member sees their own paid orders in
`/member/pesanan` (read-only, needs `member_portal`).

All writes go through security definer functions: `create_order` (can take
the payments in the same transaction), `add_order_payment`, `void_order`.
Totals and unit prices are computed in SQL from `products.price` and
`resource_bookings.price`; the client never sends a price. An order number is
`POS-<year>-<000001>` per club from `order_counters` (concurrency-safe).
An order is `open` until payments (`order_payments`, methods cash, transfer,
QRIS, other; manual records, no gateway) reach the total, then `paid`:
tracked products are locked in id order and decremented in that same
transaction, so parallel orders cannot oversell; insufficient stock fails the
whole order (`PS003`). A booking line sets `resource_bookings.paid_at` once
the order is paid. Every payment writes exactly one `cash_ledger` entry
(category `order_payment`, `order_id`, linked from `order_payments`).
Voiding a paid order restores stock once, clears `paid_at` and writes one
`manual_adjustment` `out` entry per payment ("Pembatalan pesanan ...") so the
ledger stays append-only and balanced; an open order with partial payments
cannot be voided; voiding never cancels the booking. Clients can no longer
insert ledger rows other than `manual_adjustment`. Error codes `PS001` module
off, `PS002` invalid, `PS003` stock, `PS004` payment amount, `PS005` booking
cannot be billed, `PS006` void not allowed. POS sales are not part of the
invoice-based revenue reports; they show in the cash ledger, cash flow, the
orders page and the dashboard.

## Sport club types are data

`club_types` (code, name, `ready` or `soon`, `terms`), `club_type_modules`
and `club_type_presets` define a sport; registration and "Tambah klub" list
the `ready` rows. Ready: swimming, gym, tennis, padel, pilates, yoga. Soon:
crossfit, martial_arts, dance, badminton, futsal, basketball, other.

To add a sport, with SQL only (a migration):
1. `club_types`: code, name, status `ready`, `terms` (`member`, `coach`,
   `visit`, `resource`, `session`, `location`; missing keys fall back to
   neutral words).
2. `club_type_modules`: the modules it uses (for example `members`, `plans`,
   `billing`, `cash_ledger`, `payroll`, `promo`, `member_portal`, `classes`,
   `resource_booking`, `pos`, `checkin`).
3. `club_type_presets`: facility suggestions for onboarding (kind, name
   pattern with `{n}`, count, slot minutes, default capacity).
There is no per-sport code. Verified with a throwaway `futsal`: after those
inserts a futsal club gets onboarding suggestions, bookings and the cashier
with no code change.

## Navigation

`AppShell` takes `navGroups: NavGroup[]` (`components/shared/nav-types.ts`):
a group is `{ label?, items }` and an item is `{ href, label, icon, exact?,
primary? }`. `icon` is a string key mapped to a `lucide-react` icon in
`components/shared/nav-icon.tsx`. `AppShell` also takes `profileHref`: the
profile link is the first item of the menu (sidebar top, first group of the
mobile sheet), not in the top bar. Desktop shows the sidebar (it follows the
light or dark theme) with the labelled groups; below `sm` it is a bottom tab bar (the `primary` items, at
most four, padded to three, plus "Menu") and the "Menu" button opens a
full-screen sheet with every group (animated open and close, no motion under reduced motion). When a role has five items or fewer
(coach, member) all of them are tabs and there is no "Menu".

To add a page to the admin menu: add `{ href, label, icon, module? }` to the
right group in `app/admin/layout.tsx` (module and role filtering are applied
there with `getEnabledModules` and `canAccessPath`), add a new icon key in
`nav-types.ts` and `nav-icon.tsx` if needed, and mark `primary` only for items
that belong in the phone tab bar. A group with no visible item is not shown.

## Landing page and public SEO

`/` is built from `components/landing/` in this order: header (skip link,
section links, theme toggle, mobile menu), dark hero, supported sports,
features grouped by job, how it works (stepper), multi club, pricing, FAQ
(ruled list), final call to action, footer. Only the hero is dark; the other
bands are light. A signed-in session is redirected to its home.

- Live data only: sports come from `club_types` and `club_type_modules`
  (`getPublicClubTypes`), so a status change in the table changes the page;
  prices, club limits, trial and yearly discount come from
  `subscription_plans` (`getActivePlans`) and the module list from
  `platform_modules`. The pricing picker hands plan, period and users to
  `/daftar?plan=&period=&users=`.
- Product visuals are the app's own components with sample data and carry a
  "Contoh data" label (`sample-label.tsx`). No testimonials, client names,
  logos or invented figures.
- Keeping claims true: every statement on the page has a row in the claims
  table in `progress/landing-rework-progress.md` that points to the code or
  migration proving it. When a feature changes, update the sentence and its
  row together; a `soon` module or club type is shown as "Segera hadir".
- Per-sport pages: `/olahraga/<code>` (`app/olahraga/[code]/page.tsx`,
  `components/landing/sport-page.tsx`, wording in `sport-copy.ts`) is read
  from `club_types` for ready types; the sign-up button preselects the type
  (`/daftar?jenis=<code>`). The landing cards link to them and the sitemap
  lists them. An unknown code returns HTTP 200 with `noindex` (a side effect
  of the root `loading.tsx`) and the not-found view.
- SEO: `lib/seo.ts` (`pageMetadata`: title, description, canonical, Open Graph,
  Twitter per page), `app/sitemap.ts` (with `lastModified`), `app/robots.ts`,
  `app/opengraph-image.tsx`, and a JSON-LD graph in `components/landing/json-ld.tsx`
  (Organization, WebSite, SoftwareApplication with offers from live plans).
  `/login` is `noindex` and not in the sitemap; `/privasi` and `/syarat` are
  drafts with `noindex` and a visible "Draf" notice and need legal review.
  `app/not-found.tsx` and `app/error.tsx` are branded (`status-page.tsx`).
- Env vars: `NEXT_PUBLIC_SITE_URL` (canonical URL; set it once a custom
  domain is attached, read at build time), `NEXT_PUBLIC_APP_NAME` (keep
  "27 Club"), `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_CONTACT_WHATSAPP`
  (digits only). Contact links render only when set.
- Speed: the landing renders on every request (the CSP nonce makes pages
  dynamic). Making it static needs a CSP rework and is not done; decide after
  Core Web Vitals data exists.

## Look, loading and caching

- Brand (`app/globals.css`, `public/brand/`): off-white `#F2F2EE` and
  near-black `#0E0E0E` surfaces, volt `#C8F31D` for primary buttons, the active
  item and focus (text on volt is always `#0E0E0E`; use `text-accent-foreground`,
  `#4D6400` on light and volt on dark, for coloured text, never `text-primary`).
  Source Sans 3 for text, Barlow Condensed 800 italic (`font-display`) for
  headings, metric numbers and the hero. Tinted shadows use `--shadow-ink`.
  The product name reads "27 Club".
- Loading: every route group has a `loading.tsx` with skeletons
  (`components/ui/skeleton.tsx`); a delayed spinner and a top progress bar
  (`components/shared/nav-progress.tsx`, `use-delayed-flag.ts`, `useLinkStatus`)
  appear only when a navigation is slow.
- Client cache: `experimental.staleTimes` in `next.config.ts` plus
  `unstable_dynamicStaleTime = 0` on pages that must always be fresh (money,
  check-in, attendance, booking availability, dashboard). Other list and
  settings pages are served from a 60 s router cache; saves, `revalidatePath`
  and `router.refresh` clear it. Login, registration and logout use
  `window.location.assign` so one account never sees another's cached pages.
  `use-full-prefetch.ts` prefetches the pages in `CACHED_PATHS` in full after
  load; `refresh-on-focus.tsx` refreshes live pages when the window regains focus.
- Lazy loading: charts (`components/reports/lazy-charts.tsx`), the check-in
  hourly chart, the QR generator, club and tenant switchers and the toaster
  (armed after load or first interaction) load on demand; client bundles must
  not import zod or recharts eagerly. Measurements are in
  `progress/cache-lazy-progress.md`.

## Page layout (framed cards)

Signed-in pages share one structure (the `.app-ui` class on the shell root scopes the compact control sizes, so the landing and auth pages keep theirs):

- Start every page with `PageHeader` (`components/ui/page-header.tsx`): `title`, optional `subtitle`, and the page actions as children. It renders a breadcrumb built from the grouped navigation (group label, then item label) automatically; pass `breadcrumb` only to override it.
- Put content in `Card` with `CardHeader` (title on the hatch, tools on the right) and `CardContent` (the inner body), or use `FramedCard` (`title`, `tools`, `bodyClassName`). `MetricCard` shows a title, a value and optionally a delta (`delta`, `deltaLabel`) and a sparkline (`spark`); only pass them when the page already has that data. A `Card` with `frame={false}` keeps the old flat look (used by the landing preview and the auth pages).
- `Table` draws its own frame when it stands alone and drops it inside a card; put a list's search and filters in the card's `tools`.
- Tokens: `--frame`, `--stripe`, `--radius-frame`, `--radius-inner`, `--ease-ui` and `--dur-1` to `--dur-4` (all 0 ms under reduced motion), plus the `.hatch` and `.ui-transition` utilities in `app/globals.css`. Colors and fonts are the existing tokens; do not add new ones for a page.
- Charts: rounded bar tops, horizontal gridlines, a dashed reference line, a highlighted hover band, and a visually hidden table as the text alternative (`components/reports/chart-parts.tsx`).

## Platform billing (superadmin)

The platform bills clubs separately from how a club bills its members. A
superadmin is not tied to any tenant and manages every club's plan and
status from `/superadmin`.

- Bootstrap the first superadmin from the CLI (there is deliberately no UI
  for this):
  ```bash
  SEED_SUPERADMIN_EMAIL=you@example.com SEED_SUPERADMIN_PASSWORD='a-long-password' \
  npm run seed:superadmin
  ```
- `/superadmin/login` uses its own `superadmin_session` cookie. The JWT
  carries `{ sub, superadmin: true, email, full_name }` with audience
  `club27-superadmin`, is never sent to Supabase as a bearer token, and a
  tenant session JWT is rejected there. Every portal query uses the
  service-role client; the portal groups clubs by organization, edits plans,
  subscription status and the club-limit override, and can deactivate an
  owner. `superadmins`, `platform_tenant_usage`, `platform_organization_usage`,
  `org_owners` and every write to `organization_subscriptions` and
  `subscription_plans` are unreachable from `anon`/`authenticated`.
- Billing is per **organization**, not per club. `subscription_plans`
  (Standard, Advanced) holds the only copy of prices and limits;
  `organization_subscriptions` holds the organization's plan, period
  (monthly or yearly), status (`pending`, `trial`, `active`, `suspended`,
  `cancelled`), trial end, period dates, an optional club-limit override and
  the seat columns (`seats`, `pending_seats`, `pending_seats_from`).
  `platform_modules` is a price-free registry (`ready` / `soon`) that club
  types will use later. `platform_plans`, `platform_subscriptions` and
  `organizations.max_tenants` are no longer read; they stay in the schema
  until a later cleanup migration.
- Status **suspended** or **cancelled** sets `tenants.is_active = false` on
  every club of the organization (`set_organization_status`): new logins are
  refused and live sessions lose access immediately. No data is deleted.
  Switching back to **active** or **trial** restores access.
- The superadmin sets **active** with period dates (monthly +1 month,
  yearly +1 year by default), or an owner's paid renewal does it (see
  "Renewals and payment").
- Anyone holding `billing.view` reads the subscription at
  `/admin/klub/langganan`; `billing.manage` requests renewals and seat
  purchases there. The superadmin edits plans, status, trial end and
  club-limit override.

### Invitations and password reset

- **Invitations** (`invitations`, `create_invitation`, `accept_invitation`): an
  admin with `staff.manage` or `coaches.manage` invites a name and email to
  one club with a role; the page `/undangan/<token>` lets the person create an
  account (username and password) or, when the email already has an account,
  sign in and accept. Only the SHA-256 of the token is stored; links last 7
  days, work once, and a new invitation to the same club and email replaces the
  pending one. A paid role takes a seat when accepted (`SW005` when full). With
  `EMAIL_API_KEY` the link is emailed (and a new account's email counts as
  verified); otherwise it is shown once to the inviter. A co-owner invitation
  is organization-wide: the person becomes `owner` and gets an owner profile in
  every club, and every club created later gives every owner a profile.
- **Password reset** (`password_resets`, `consume_password_reset`): `/lupa-sandi`
  emails a one-hour single-use link (hashed token, rate limited per IP and per
  email, same answer whether or not the email exists); an admin can create the
  same link for staff from `/admin/staff`. Using it replaces the password,
  clears lockout and signs every session out.
- **Re-authentication**: inviting a co-owner and transferring ownership ask for
  the acting account's password again (`lib/auth/reauth.ts`, five failures per
  ten minutes lock further attempts).
- **Ownership transfer** (`/admin/klub/pemilik`, `transfer_ownership`): only the
  main owner (`p_owner`) can move the role to another active owner; the previous
  main owner stays an owner; recorded in `audit_log`.
- **Create an organization from an account** (`/akun`): any signed-in account,
  including a member, can create its own organization; it keeps its other
  contexts.

### Deleting an organization

- The main owner (`/admin/klub/hapus`, name + password) calls
  `request_organization_deletion`: subscription becomes `cancelled` (previous
  status remembered), every club is switched off, pending invitations are
  revoked and `purge_after` is set 30 days ahead. Signing in lands on `/akun`,
  where `cancel_organization_deletion` restores everything until `purge_after`.
- `purge_candidates()` lists organizations past `purge_after` (`owner_deleted`)
  and organizations past the grace period (`grace_expired`).
  `purge_organization(org, execute)` counts what would go by default; with
  `execute` it needs the candidate state and `platform_flags.purge_enabled`
  (off), deletes in a fixed order inside one transaction, checks that no row
  with the organization's `tenant_id` or `organization_id` is left (it rolls
  back otherwise) and writes `organization_purges`. Nothing calls it on a
  schedule. Accounts stay; legacy `member_accounts` left without a profile are
  removed; files in storage buckets are not touched by SQL. `/superadmin/purge`
  shows candidates and the dry-run counts.

### Renewals and payment

- Status `expired` is set by `expire_subscriptions` (daily cron
  `/api/cron/subscriptions`, 07.00 WIB) when a trial or paid period ends; the
  same run applies due seat reductions. The phase itself is derived from the
  dates by `subscription_phase` (SQL) and `billingPhase` (`lib/billing/access.ts`,
  same rules): `trial`, `active`, `grace`, `ended`, `pending`, `unverified`,
  `suspended`.
- **Grace period** (`subscription_plans.grace_days`, 365): after a trial or
  paid period lapses everyone can still sign in and read, but every write
  from a user session is rejected with `SW003` (trigger `a00_org_writable` on
  every table that has `tenant_id`, except `audit_log`, `consents`,
  `platform_subscriptions`, `organization_member_clubs`; service-role work such
  as renewals is unaffected). Layouts show a read-only banner. After the grace
  period (`ended`), and for `pending` or `unverified`, only the owner and
  holders of `billing.view` can open the billing page (`requireRole` redirect);
  everyone else is signed out with `?expired=1`. Data is kept.
- A user with `billing.manage` submits a renewal (`request_renewal`, table
  `subscription_renewals`; plan, period, seats, amount from `platform_quote`).
  With `MIDTRANS_SERVER_KEY` set, the app creates a Midtrans Snap link
  (`lib/payments/midtrans.ts`, `payment_order_id`, `payment_url`) and the
  notification handler `/api/payments/midtrans` checks the signature, re-reads
  the status from the Midtrans API, compares the amount, then calls
  `confirm_renewal`. Without the key, the superadmin confirms by hand.
- `confirm_renewal` is idempotent and extends the period from the current end
  when still active, otherwise from today; a gateway payment is honoured even
  if the request was cancelled meanwhile. A renewal can lower the seat count:
  it is stored as `pending_seats` and applied when the new period starts
  (`expire_subscriptions`); the seat cap uses the lower number meanwhile.
- **Seat purchase** (`request_seat_purchase`, a `subscription_renewals` row with
  `kind = 'seats'`): only while `active`; amount = seats added × price per seat
  for the period × remaining days ÷ period days (inclusive of today), rounded
  to whole rupiah, computed by `seat_quote`. Paying (Midtrans or manual
  `confirm_renewal`) adds the seats once without moving the period. One pending
  request per organization; a new one replaces it.
- Reminders: a banner 7 days before the end (always for a trial) and, with
  `EMAIL_API_KEY` set, emails at 7 and 1 days (`subscription_reminders`).
- Not built: invoices or receipts for the platform itself, proration, refunds.

### Pricing model

- Price = **seats** × `price_per_user_month` × months. A seat is an active
  `organization_members` row (owner or staff with a paid role; one per person
  per organization however many clubs). Free roles, coaches, kasir and members
  take no seat. `seats` is what the organization bought (trial: 1); the
  trigger `organization_members_enforce_seats` rejects a new or reactivated
  member beyond `least(seats, pending_seats)` with `SW005` (the subscription
  row is locked, so parallel inserts cannot exceed it). Monthly = 1 month;
  yearly = 12 − `yearly_free_months` (11.5). The effective monthly price is
  the total ÷ 1 or ÷ 12.
- Seeded values: Standard Rp 150.000/seat/month, up to 3 clubs; Advanced
  Rp 250.000/seat/month, unlimited clubs; both with a 14-day trial of 1 seat
  (`trial_days`, `trial_seats`). Members and locations are unlimited on both;
  every `ready` module is included.
- `platform_quote(plan, period, users)` is the server-side calculation
  (execute revoked from clients). The landing page and wizard show a live
  estimate with the same formula over the plan rows; every authoritative
  figure (registration, renewal, seat purchase and its preview, the
  superadmin portal) is recomputed on the server
  and nothing price-related is read from the client.
- Gates (`SW003`): `enforce_billing_gate` rejects adding members, clubs or
  seats unless the phase is `trial` or `active`, and the write guard above
  covers everything else a user session writes. The organization's first
  club is exempt so registration can complete. `SW005`: no free seat. `SW004`:
  a new club beyond `coalesce(club_limit_override, plan club limit)` is
  rejected (the subscription row is locked, so parallel creations cannot
  exceed it), and a plan or override change that leaves the organization
  over the limit is rejected, which blocks Advanced → Standard with more
  than 3 clubs.
- Infrastructure floor for reference: Vercel Pro ≈ $24/mo + Supabase Pro ≈
  $25/mo + usage buffer ≈ $20–30 → ≈ Rp 1.300.000/month at ≈ Rp 17.900/USD
  (verify before relying on it); marginal cost per extra organization ≈ 0
  until a higher tier is needed.

## Notes / out of scope

- Swim competition (lomba renang) tracking is intentionally not built, but
  nothing in the schema (e.g. `class_types`) assumes it can't be added
  later.
- WhatsApp is not integrated. A club's member invoices are marked paid
  manually by an admin; Midtrans is used only for the platform subscription.
- Admins invite coaches and staff by link (no temporary password). Members sign in read-only after an admin or their coach activates
  the account; there is no self-registration and no parent role.
- Not built: taxes and discounts on orders, barcode scanners, receipt printers (the browser prints), returns and partial refunds, supplier purchasing, member-invoice payment gateway, invoices or receipts for the platform itself,
  proration, automatic charging, coupons,
  per-module pricing, a coach in several clubs, moving a club between
  organizations, self-registration, member self-booking of classes,
  invitations or password reset by email, one person as both coach and
  member, check-out, geofence, staff scanning the member's QR, door
  hardware, CSV export of check-ins, push notifications.

