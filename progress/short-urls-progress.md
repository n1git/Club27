# short-urls progress

Status: all phases done; migration 066 applied to hosted 2026-10-21 (dry run passed, 0 reserved-name clashes, version 20250101000066).

- [x] Phase 0: table, references, top-level list, clash report, plan
- [x] Phase 1: rename folders, references, redirects
- [x] Phase 2: `/p/[id]` page and modal
- [x] Phase 3: migration (not applied)
- [x] Phase 4: `/<username>` page, `/profile` toggles, tests

Pulled `main` at `4d8140f`.

## Final old-to-new table

Every row is one 308 straight to the final path (the table in `next.config.ts` is rewritten so no old path points at another old path). Query strings are kept by the framework.

| Old path(s) | New path |
|---|---|
| `/sports`, `/olahraga` | `/s` (the list page) |
| `/sports/:code`, `/olahraga/:code` | `/s/:code` |
| `/invite/:token`, `/undangan/:token` | `/i/:token` |
| `/invite`, `/undangan` (no page today, they 404) | `/` |
| `/reset-password/:token`, `/atur-ulang-sandi/:token` | `/r/:token` |
| `/reset-password`, `/atur-ulang-sandi` (no page today) | `/forgot-password` |
| `/checkin/hasil` | `/checkin/result` |
| `/home`, `/akun` | `/` |
| `/home/workouts`, `/akun/latihan` | `/workouts` |
| `/home/friends`, `/akun/teman` | `/friends` |
| `/home/groups`, `/akun/grup` | `/groups` |
| `/home/groups/:id`, `/akun/grup/:id` | `/g/:id` |
| `/home/challenges` | `/challenges` |
| `/home/challenges/:id` | `/c/:id` |
| `/home/health` | `/health` |
| `/home/settings`, `/akun/pengaturan` | `/settings` |
| `/home/upgrade`, `/akun/upgrade` | `/upgrade` |
| `/home/join-club`, `/akun/klub` | `/join` |
| `/akun/profil`, `/admin/profile`, `/coach/profile`, `/member/profile` | `/profile` (unchanged target) |
| `/admin/billing/invoices` | `/admin/invoices` |
| `/admin/billing/packages` | `/admin/packages` |
| `/admin/billing/subscriptions` | `/admin/subscriptions` |
| `/admin/cash-ledger` | `/admin/cash` |
| `/admin/club/subscription`, `/admin/klub/langganan` | `/admin/plan` |
| `/admin/join-requests`, `/admin/permintaan-gabung` | `/admin/requests` |
| `/admin/settings/modules`, `/admin/settings/modul` | `/admin/modules` |
| `/admin/checkin/screen/:pointId`, `/admin/checkin/layar/:pointId` | `/admin/screen/:pointId` |
| `/admin/checkin/screen`, `/admin/checkin/layar` (no page today) | `/admin/checkin` |
| other `/daftar`, `/lupa-sandi`, `/privasi`, `/syarat`, `/admin/fasilitas`, `/admin/kasir`, `/admin/pesanan`, `/admin/produk`, `/admin/peran`, `/admin/klub/*`, `/member/pesanan|kunjungan|klub`, `/superadmin/laporan` | same targets as today (already final) |

New routes: `/s` (moved list page), `/p/[id]` and its modal, `/<username>`, `/` for a signed-in personal account.

Kept as they are: `/admin/club` (+ `delete`, `export`, `owners`), `/admin/members|coaches|schedule` with their ids and `@modal` routes, `/admin/orders/[id]`, `/coach/attendance/[classId]`, `/member/*`, `/profile`, `/change-password`, `/signup`, `/signup/account`, `/login`, `/forgot-password`, `/privacy`, `/terms`, `/checkin` (route handler), all `/api/*`, `/superadmin/*`.

Not renamed on purpose: `/coach/attendance/[classId]` has two segments but the second is an id, like `/admin/orders/[id]`.

## Files that match an old path (code only)

- `/home`: `app/home/**` (moves), `app/api/export/account/route.ts`, `components/health/{measurement-form,measurement-table}.tsx`, `components/shared/personal-shell.tsx`, `lib/actions/{challenges,club-join,groups,health,invitations,leaderboards,organization,social,workouts}.ts`, `lib/auth/roles.ts` (`PERSONAL_HOME`, `canAccessPath`), `lib/auth/contexts.ts`, `app/api/accounts/register/route.ts`, `proxy.ts`, `next.config.ts`.
- `/sports`: `app/page.tsx`, `app/sitemap.ts`, `app/sports/**` (moves), `components/landing/{business-section,landing-footer,sport-page,sports-section}.tsx`, `next.config.ts`; also `app/sports/[code]/page.tsx` canonical, Open Graph and JSON-LD URLs.
- `/invite`: `app/invite/[token]/page.tsx`, `components/organization/owner-forms.tsx`, `components/shared/{account-form,resend-invitation-form,reset-password-form}.tsx`, `lib/accounts/invitations.ts` (emailed link), `lib/actions/invitations.ts`.
- `/reset-password`: `app/admin/staff/page.tsx`, `components/coaches/coach-edit-form.tsx`, `lib/accounts/password-reset.ts` (emailed link).
- `/checkin/hasil`: `app/checkin/route.ts`.
- `/admin/billing`: `app/admin/billing/**` (moves), `app/admin/{layout,page}.tsx`, `lib/actions/billing.ts`, `lib/auth/permissions.ts`.
- `/admin/cash-ledger`: `app/admin/cash-ledger/**` (moves), `app/admin/layout.tsx`, `lib/actions/{billing,cash-ledger,orders,payroll}.ts`, `lib/auth/permissions.ts`.
- `/admin/club/subscription`: `app/admin/club/page.tsx`, `app/admin/layout.tsx`, `app/api/cron/subscriptions/route.ts` (reminder email link), `components/shared/account-form.tsx`, `components/subscription/{read-only-banner,subscription-banner}.tsx`, `lib/actions/subscription.ts`, `lib/auth/permissions.ts`, `lib/billing/{access,renewals}.ts`.
- `/admin/join-requests`: `app/admin/layout.tsx`, `lib/actions/club-join.ts`, `lib/auth/permissions.ts`.
- `/admin/settings/modules`: `app/admin/settings/page.tsx`. `/admin/checkin/screen`: `components/checkin/points-manager.tsx`.
- Not in code but updated in Phase 1: `docs/ARCHITECTURE.md`, `CLAUDE.md`, `README.md`, `docs/DEPLOY.md`, the claims table in `progress/landing-rework-progress.md` (links), `docs/CHANGELOG.md` (new entry only; history stays).

## Access rules that must be rewritten (no loosening)

- `lib/auth/roles.ts`: `PERSONAL_HOME` becomes `/`. `canAccessPath` today sends anything under `/home` to role `personal` only. After the flattening the same rule must cover each personal path by exact segment: `/workouts`, `/friends`, `/groups`, `/challenges`, `/health`, `/settings`, `/upgrade`, `/join`, `/g/*`, `/c/*`, `/p/*`. Role `personal` only, as now (owner, staff and member get redirected to their home). Segment-exact matching, never `startsWith("/p")`.
- `proxy.ts`: `PROTECTED_PREFIXES` uses `startsWith`; it gets the same exact-segment list (signed-out visitors go to `/login`). `/` and `/<username>` are public. `GUEST_ONLY_PREFIXES` unchanged. The matcher already covers everything except `_next`, images, `favicon.ico`, `api/`.
- `lib/auth/permissions.ts` (`ADMIN_PATH_RULES`, `BILLING_PREFIX`, `OWNER_ONLY_PREFIXES`): `/admin/club/subscription` is the one path under `/admin/club` that `billing.view` holders may open; `/admin/plan` takes that exact rule (owner or `billing.view`), and `/admin/club` stays owner-only. `/admin/invoices` keeps `invoices.view`; `/admin/packages` and `/admin/subscriptions` keep the three-permission set they have today under `/admin/billing` (not tightened, not loosened). `/admin/cash` keeps `cash_ledger.view`; `/admin/requests` keeps `members.create`; `/admin/modules` keeps `club.settings` (it was under `/admin/settings`); `/admin/screen` keeps `checkin.manage` (it was under `/admin/checkin`).
- `lib/billing/access.ts` `BILLING_OPEN_PATHS` (the only paths a locked owner can open): `/admin/club/subscription` becomes `/admin/plan`; `/admin/club/export` and `/profile` unchanged. The first entry is also the redirect target, so it must change too.
- `/p/[id]` is a personal-area page: only role `personal` can open it; any other signed-in role is redirected like the other personal paths. Signed-out visitors cannot see posts at all (the `posts_visible` policy needs `current_account_id()`).
- `/<username>`: signed-out visitors, and signed-in roles other than `personal` (club context), get the public view only (name and `@username` when "Profil publik" is on). Relation actions and posts appear only for role `personal`.

## Real top-level list (after the rename)

Routes: `admin`, `api`, `change-password`, `checkin`, `coach`, `forgot-password`, `home` (redirect only), `invite` (redirect only), `login`, `member`, `privacy`, `profile`, `reset-password` (redirect only), `signup`, `sports` (redirect only), `superadmin`, `terms`, and new `s`, `i`, `r`, `p`, `g`, `c`, `workouts`, `friends`, `groups`, `challenges`, `health`, `settings`, `upgrade`, `join`. Old Indonesian names that only redirect: `daftar`, `akun`, `olahraga`, `privasi`, `syarat`, `undangan`, `lupa-sandi`, `atur-ulang-sandi`.

Files served from the root (the username pattern `^[a-z][a-z0-9._]{2,29}$` allows dots, so these are real clashes): `robots.txt`, `sitemap.xml`, `favicon.ico`, `icon.svg`, `apple-icon.png`, plus `opengraph-image`.

Reserved set to add (code and database): every route above, the root files above, and `www`, `app`, `help`, `support`, `root`, `system`, `ruzz`, `club27`, `superadmin`, `admin`, plus a few future names: `about`, `blog`, `contact`, `docs`, `explore`, `pricing`, `search`, `status`, `static`, `public`, `assets`, `me`, `new`, `edit`, `delete`, `official`, `staff`, `team`, `info`, `mail`, `email`, `webmaster`, `postmaster`, `null`, `undefined`. Names with a hyphen (`forgot-password`, `change-password`, `reset-password`, `opengraph-image`) cannot be usernames anyway; they are listed for completeness.

## Username clash report

Read-only query on the hosted database against the full list above: **0 accounts clash**. Local test databases are throwaway. The database trigger `accounts_username` (`before insert or update of username`) calls `username_reserved()`, so the new list blocks new names and renames; existing rows are not re-checked, so I will rerun this query after the migration and report any clash before it matters.

## Where the username lives

`accounts.username` (not null, unique through `username_taken()`, `CHECK ^[a-z][a-z0-9._]{2,29}$`, changeable once per 30 days via `username_changed_at`). Superadmins have their own namespace (`superadmins.username`). Reserved check: `username_reserved(text)` in the database (trigger `accounts_username` via `enforce_username`, `suggest_username`) and `RESERVED_USERNAMES` in `lib/username-suggest.ts` (zod `usernameSchema`). There is no avatar column; the page will show name and `@username` only.

## How `/` is split without breaking the landing page and login redirect

- `app/page.tsx` stays the one route for `/`. Today it redirects any session to `roleHome`. New behaviour: no session shows the landing page (unchanged); role `personal` renders the personal home inside the personal shell; owner, staff and member keep being redirected to their home (`/admin/club`, `/admin`, `/member`), exactly as now.
- The personal pages move to a route group `app/(personal)/` that holds the shared layout (`requireRole("personal")` + `PersonalShell`). The home body moves to `components/personal/home-page.tsx`; `app/page.tsx` renders it wrapped by the same shell component for a personal session, so `/` and `/workouts` look the same.
- Login and registration redirect to `PERSONAL_HOME`, which becomes `/`; the guest-only redirect for a signed-in visitor on `/login` goes to `/` for personal accounts. Signed-out `/home` used to bounce to `/login`; now `/home` is a plain 308 to `/`, so a signed-out visitor sees the landing page (same as Instagram).

## Other points to confirm

1. `/sports` list page moves to `/s`, because `/s/[code]` implies it (Decision 1 only names the detail page).
2. Unknown top-level URLs now reach `app/[username]/page.tsx`, which returns the shared not-found view. The root `loading.tsx` already makes not-found pages return HTTP 200 in this app (noted in `docs/ARCHITECTURE.md`); I will keep every miss identical, 200 and `noindex`, rather than change that for one route.
3. Profile data for a signed-in viewer needs a lookup that is not limited to related people (`social_people` only lists friends, group peers and similar). The migration adds one security definer function that takes the exact username, checks active, not banned and not blocked either way, and returns name, username and the relation; no list or search function.
4. Public profile: `accounts.public_profile` and `accounts.public_search_ok` (default false). Anonymous may execute only `public_profile_by_username(text)`, which returns name and username when `public_profile` is on and the account is active and not banned.
5. The posts table, comments and reactions code already exist (`lib/data/social.ts`, `lib/actions/social.ts`); `/p/[id]` reuses them. Share cards under `/api/cards/[kind]/[id]` stay.
6. I will not apply the migration to hosted; it goes in the progress file with its dry-run command.

## Phase 1 result

- Folders moved with `git mv`: `app/s` (was `sports`), `app/i`, `app/r`, `app/checkin/result`, `app/(personal)/{workouts,friends,groups,g/[id],challenges,c/[id],health,settings,upgrade,join}`, `app/admin/{invoices,packages,subscriptions,cash,plan,requests,modules,screen/[pointId]}`. The old `app/home`, `app/admin/billing` and empty folders are gone.
- `/`: `app/page.tsx` shows the landing page without a session, the personal home (`components/personal/home-page.tsx` inside `components/personal/personal-layout.tsx`, the same shell as the `(personal)` group) for role `personal`, and redirects owner, staff and member as before.
- References updated in code, emails (`/i/<token>`, `/r/<token>`, `/admin/plan` in reminders), sitemap, canonical, Open Graph and JSON-LD URLs, `revalidatePath` (the former `"/home", "layout"` is now `"/", "layout"`), `redirect()` strings, docs (`ARCHITECTURE.md`, `CLAUDE.md`, `README.md`) and a CHANGELOG entry.
- `next.config.ts`: `MOVED_PATHS` rewritten; 64 old URLs checked with `curl`-style requests against the dev server: every one is a single 308 straight to its final path (`progress/short-urls-progress.md` table; query strings kept).
- Access rules: `lib/auth/roles.ts` (`PERSONAL_HOME` is `/`, `PERSONAL_PATHS`, `isPersonalPath`, `underPath` exported), `proxy.ts` (segment-exact protected paths), `lib/auth/permissions.ts` (rules for the renamed paths, `BILLING_PREFIX` is `/admin/plan`), `lib/billing/access.ts` (`BILLING_OPEN_PATHS`), `RESERVED_USERNAMES` extended to the full list.
- Proof that nothing loosened: a script ran the old and new `adminPathAllowed` on 120,000 combinations (owner or not, 4,000 random permission sets, each old path against its new path): 0 differences; `canAccessPath` for the four roles over every old/new personal and role path: 0 differences.
- Browser run on a local database: signed-out `/` is the landing page and every protected path goes to `/login`; a login lands on `/` with the personal menu; every flattened personal path opens; entering a club opens `/admin/club`, then `/admin/plan`, `/admin/invoices`, `/admin/packages`, `/admin/subscriptions`, `/admin/cash`, `/admin/requests`, `/admin/modules`, `/admin/club/export`, `/admin/checkin`; from a club context the personal paths and `/` send the owner to `/admin/club`.
- `npx next typegen && npx tsc --noEmit` is clean. eslint has one error that was already on `main` (`components/social/post-composer.tsx`, set-state in an effect) and is not part of this change.

## Phase 2: `/p/[id]` page and modal

- `app/(personal)/p/[id]/page.tsx` (full page, `noindex`) and `app/@modal/(.)p/[id]/page.tsx` (modal), both through `components/social/post-view.tsx`: personal role only, social-banned viewers get not-found, data from the new `getPost` (the feed's hydration code was extracted so feed and permalink share it; `posts_visible` decides). The root layout gained a `modal` slot with `app/@modal/default.tsx`. The post time in the feed is now a link to `/p/<id>`.
- Browser test on a local database (two friends, a stranger, an author with a hidden post): friend opens the page; clicking the time in the feed opens a dialog over the feed and a reload shows the full page; unknown id, malformed id and a hidden post look identical (same status, title and text); an unrelated account sees the same not-found as for a missing post; the author still sees their own hidden post; signed out goes to `/login`; an owner in a club context cannot open it.

## Phase 3: migration (NOT applied)

`supabase/migrations/20250101000066_public_profiles.sql`: `accounts.public_profile` and `accounts.public_search_ok` (both default false, check that search needs profile), `username_reserved` with the full list (same as `RESERVED_USERNAMES`), `account_is_minor(uuid)`, `profile_by_username(text)` (authenticated only; exact username; self, friends, pending, none; nothing for unknown, reserved, inactive, banned, blocked either way or under-18) and `public_profile_by_username(text)` (anon and authenticated; name, username and search flag only, only when `public_profile` is on and the account is active, not banned and not under 18). Idempotent; the last block raises a notice naming any existing account whose username is now reserved (the hosted check found none).

Test file: `supabase/tests/public_profiles_phase8.sql` (defaults, constraint, reserved insert and rename, anon limits, every miss case, relations, blocks both ways, minors). All 17 SQL suites pass on a fresh database through 066.

To apply (for the owner): `supabase db push --dry-run` (needs `SUPABASE_ACCESS_TOKEN` and the database password); without them, dry-run the file in a rolled-back transaction with `execute_sql`, then `apply_migration` and rename the history version to `20250101000066`. Apply it before the new app version goes live: the code tolerates the missing columns and functions (the profile page shows the switches off, `/<username>` treats every error as not-found, and saving the switches reports an error), but profiles and the switches only work after the migration.

## Phase 4: `/<username>` and the `/profile` switches

- `app/[username]/page.tsx` with `lib/data/public-profile.ts` (cached per request, shared by metadata and page): normalises and validates the name, rejects reserved names, rate-limits by IP with `hit_rate_limit` (120 per minute, fails open), then calls `profile_by_username` for a signed-in personal account that is not social-restricted, or `public_profile_by_username` with an anonymous client for everyone else (signed out, owner, staff, member in a club context). Misses use the shared not-found view, `noindex`, same status.
- Signed-in view: name, `@username`, the existing friend request action (`sendFriendRequest`), relation text, and for friends and yourself the latest posts through `posts_visible`. Signed-out view: name, `@username` and sign-up buttons; indexable only when "Boleh dicari Google" is on, with its own title and a lowercase canonical; otherwise `noindex`.
- `/profile` has a "Profil publik" section (two switches, `updatePublicProfile`, audit entry `profile.public`); under-18 member accounts cannot turn it on. A form-reset bug found in testing (the controlled checkbox came back unchecked after saving) is fixed by keying the form on the saved values.
- Browser test (local database, migration applied): signed-out `/pb0` equals an unknown name while the profile is off; the toggle saved through the UI; public view shows only name and @username (no email, no posts); search off gives `noindex`, search on gives a normal title and no `noindex`; `/PB0` resolves and canonicalises to `/pb0`; a friend sees relation and post but not the hidden post; a stranger gets "Tambah teman" and no posts; own page shows the edit link; signed-in exact lookup works with the public profile off; blocked (either way), inactive and banned accounts are not-found; an owner in a club context sees only the public view, and not-found when it is off; lookups are counted by `hit_rate_limit`; `/login`, `/s`, `/workouts` and `/robots.txt` still resolve to their own routes. `/p` signed out goes to `/login` because it is a protected personal path.
- Regression after Phase 4: the 64 old URLs still give one 308 each; the signed-out, personal and owner navigation run passes (49 checks); the post page run passes.

## Notes for the owner

- Reserved-name rule: every new top-level segment must be added to `RESERVED_USERNAMES` and `username_reserved` (noted in `CLAUDE.md`).
- Not-found pages return HTTP 200 (existing behaviour from the root `loading.tsx`); all misses are identical, so profile existence is not revealed by status or text. Timing is not equalised.
- No avatar exists in the data, so none is shown; unknown, private and blocked profiles cannot be told apart.

## Hosted rollout of 066

Another session had already applied `066` and recorded it (`9b39e38`). On the owner's "oke" I dry-ran the file on hosted in a rolled-back statement (0 accounts clash, anonymous can run only `public_profile_by_username`, `profile_by_username` is authenticated only, `account_is_minor` has no client grant) and then applied it; every statement is idempotent, so the second run changed nothing. The extra history row it created (`20261020183218 public_profiles`) was removed; history ends `...064 post_media_reactions, 065 more_sports, 066 public_profiles`. Hosted check afterwards: both columns present, three functions present, 0 reserved-name clashes.
