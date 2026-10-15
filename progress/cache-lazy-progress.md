# cache-lazy progress

Status: all phases done.

- [x] Phase 0 — measure and plan
- [x] Phase 1 — cache and invalidation
- [x] Phase 2 — prefetch and live parts
- [x] Phase 3 — lazy loading, after measurement

## Phase 0

Commit: this file. No app code changed. One production build was needed to serve the app for the measurement (the analyzer does not produce a runnable build); sizes below come from `next experimental-analyze -o`.

### Baseline (375 px, mobile emulation, Fast 3G: 1.6 Mbps down, 750 Kbps up, 562 ms RTT, 4x CPU slowdown, production build)

Navigation by bottom-bar tabs, click to content visible. Legs 3 and 4 are revisits within 60 s.

| Role | First leg | Second leg | Revisit 1 | Revisit 2 | Back to start |
|---|---|---|---|---|---|
| admin | 1348 ms | 691 ms | 677 ms | 670 ms | 742 ms |
| coach | 1279 ms | 715 ms | 709 ms | 711 ms | 708 ms |
| member | 1325 ms | 685 ms | 694 ms | 677 ms | 703 ms |

Every leg, including revisits, makes one server request (about 700 ms, one round trip). Superadmin has no tab navigation, so only its first load is measured. Raw data: legs per role are in the table above; 5 legs each, the first admin leg has 2 requests.

First load, cache disabled (JS and total are transferred KB, gzip):

| Route | JS KB | Total KB | Requests | Load ms |
|---|---|---|---|---|
| `landing /` | 173 | 276 | 18 | 3069 |
| `login /login` | 172 | 264 | 23 | 3093 |
| `dashboard /admin` | 179 | 283 | 25 | 3138 |
| `daftar /daftar` | 266 | 350 | 19 | 3490 |
| `/admin/reports` | 284 | 383 | 26 | 3695 |
| `/admin/checkin` | 284 | 384 | 26 | 3741 |
| `/admin/staff` | 272 | 373 | 26 | 3634 |
| `/admin/profile` | 271 | 371 | 26 | 3629 |
| `/admin/kasir` | 183 | 281 | 25 | 3159 |

First-load JS per route from the analyzer (uncompressed): 559 KB for most pages, 483–550 KB for public pages, 920–957 KB for 13 routes that carry one of two heavy chunks.

### Heavy client parts (analyzer, uncompressed / gzip)

| Part | Size | Where it loads | Cause |
|---|---|---|---|
| zod | 391 KB / 90 KB | `/admin/profile`, `/admin/staff`, `/admin/members/[id]`, `/admin/coaches/new`, `/coach`, `/coach/profile`, `/member/profile`, `/superadmin`, `/superadmin/profile`, `/daftar` | `components/shared/username-field.tsx` imports `suggestUsername` and `components/superadmin/organization-controls.tsx` / `profile-view.tsx` import `STATUS_LABEL`, from modules that also build zod schemas |
| recharts | 361 KB / 104 KB | `/admin/reports`, `/admin/checkin` | `components/reports/{revenue,cashflow}-chart.tsx`, `components/checkin/hourly-chart.tsx` |
| qrcode-generator | 22 KB / 8 KB | `/admin/checkin/layar/[pointId]` | `components/checkin/qr-screen.tsx` (the main content of that screen) |
| landing client islands | 41 KB / 14 KB | `/` | header, mobile menu, pricing calculator |

There is no QR scanner, date picker library, PDF or export code in the bundle (check-in scans use the phone camera app, dates are native inputs, receipts use `window.print`), so decision 5 has nothing to lazy load for those.

### Server actions

76 exported actions in `lib/actions`; 50 call `revalidatePath` directly and most of the rest call a local `refresh()` or `revalidateX()` helper. Reading actions (search, preview, token fetch) do not mutate. Only `resetUserPassword` mutates without any revalidation; it changes nothing a page shows, so no change is planned.

The real gaps are outside actions:
- `components/shared/login-form.tsx`, `logout-button.tsx`, `register-club-form.tsx`, `superadmin-login-form.tsx` and `superadmin-logout-button.tsx` change the session cookie in an API route and then call `router.push`. A route handler does not purge the client cache, so with a 60 s cache a second account in the same tab could be shown the first account's cached pages. They need a hard navigation (decision 4).
- `switchTenant` (`lib/actions/owner.ts`) and the member `switchClub` are server actions that set the session cookie and redirect, which purges the client cache per the docs; to be confirmed by a test in Phase 2.
- Changes made by other people (a member books, a coach marks attendance) are not seen until the cache expires: this is what refresh-on-focus and the never-stale list below address.

No unread or pending counters exist in the app today, so decision 3 applies to today's check-ins, booking availability and the dashboard figures only.

### How the cache works in this Next.js version (read in `node_modules/next/dist/docs`)

- `experimental.staleTimes.dynamic` is global; the page-level export `unstable_dynamicStaleTime` (pages only, in `app-segment-config`, not in the docs) overrides it per page. I will use `export const unstable_dynamicStaleTime = 0` on never-stale pages and verify with a test that it really bypasses the cache.
- `revalidatePath`, `revalidateTag`, `router.refresh()` and setting or deleting a cookie from a server action purge the client cache.
- `staleTimes.static` (default 5 min) also applies to `router.prefetch` and `<Link prefetch={true}>`, which fetch the full dynamic payload. Left at 5 min, a prefetched page could be 5 min old.

### Plan

Phase 1
- `experimental.staleTimes = { dynamic: 60, static: 60 }` in `next.config.ts`.
- `unstable_dynamicStaleTime = 0` on the never-stale pages: `/admin`, `/admin/billing/*`, `/admin/cash-ledger`, `/admin/payroll`, `/admin/kasir`, `/admin/pesanan` and `[id]`, `/admin/booking`, `/admin/checkin`, `/admin/schedule` and `[id]`, `/admin/reports`, `/admin/klub/langganan`, `/admin/members/[id]`, `/coach/schedule`, `/coach/attendance/[classId]`, `/member`, `/member/booking`, `/member/pesanan`, `/member/kunjungan`, `/superadmin`.
- Cached for 60 s: `/admin/members`, `/admin/coaches`, `/admin/staff`, `/admin/produk`, `/admin/fasilitas`, `/admin/promo`, `/admin/settings` and `/admin/settings/modul`, `/admin/klub`, `/admin/audit`, `/coach`, `/coach/members`, `/member/klub`, and the profile pages.
- Login, register, logout (all roles) end with a hard navigation.

Phase 2
- A shell effect prefetches only the 60 s pages of the current role's main nav, after idle, skipped on `saveData` or 2g. Never-stale pages keep the default link prefetch (shell and `loading.tsx` only).
- Refresh on window focus (throttled to once per 15 s) on `/admin`, `/admin/checkin`, `/admin/booking`, `/member/booking`; mutations already purge the cache.
- Tests: switch tenant, switch club, logout then login as another account in one tab.

Phase 3
- Charts via `next/dynamic` with a fixed-height skeleton.
- Move `suggestUsername` and `STATUS_LABEL` into zod-free modules (same exports re-exported where server code uses them), which removes zod from the client bundle of the ten routes above.
- `qrcode-generator` loaded with a dynamic `import()` inside the effect, skeleton the same size as the code.
- Landing: look at the 41 KB island; lazy load the pricing calculator only if it saves more than it costs; keep SSR.
- Repeat the Phase 0 measurement.

### Decisions (owner OK: all three)

Strict reading of never-stale (those pages are refetched on every visit), `unstable_dynamicStaleTime` allowed, `staleTimes.static = 60`.

## Phase 1 — cache and invalidation (done)

- `next.config.ts`: `experimental.staleTimes = { dynamic: 60, static: 60 }`.
- `export const unstable_dynamicStaleTime = 0;` on the 27 never-stale pages (dashboard, billing, cash ledger, payroll, POS and orders, booking, check-in, schedule and its detail, reports, org billing, member detail, coach schedule, attendance, coach home, member home, booking, orders and visits, superadmin home).
- Login, register, superadmin login and all logouts end with `window.location.assign` instead of `router.push` plus `router.refresh`.
- Browser test on a production build: a cacheable page revisit makes no data request; never-stale pages and the dashboard refetch; a saved change refreshes the cached pages; after logout and login as another account in the same tab no page of the first account is shown.

## Phase 2 — prefetch and live parts (done)

- Sidebar and bottom-bar links of the cacheable pages use `prefetch={true}` (full payload) after the page has loaded plus 1.5 s, skipped on `saveData` and 2g (`components/shared/use-full-prefetch.ts`). `router.prefetch` only fetches the shell in this version, so `<Link prefetch>` is used. Never-stale pages keep the default link prefetch.
- `RefreshOnFocus` (throttled to once per 15 s) on the dashboard, check-in, admin booking and member booking.
- Tests: a prefetched page opens without a data request; the 60 s limit expires (refetch after 62 s); focus refresh runs once and is throttled; switching club shows the new club's pages (the server action sets the cookie and purges the cache).

## Phase 3 — lazy loading (done)

- zod no longer ships to ten routes: `lib/username-suggest.ts` and `lib/platform-status.ts` hold the zod-free parts, the schema modules re-export them.
- `next/dynamic` with a same-size `Skeleton`: the three recharts charts, the club and member club switchers (skeleton sized like the control, 44 px on phones), the sonner toaster (mounted after load plus 1.5 s or on the first tap or key, never on `/`, `/login`, `/privasi`, `/syarat`), and the QR generator (dynamic `import()` in the existing placeholder).
- Tried and reverted: lazy landing pricing (SSR on): it added a request and no saving.
- No layout jump from the charts and switchers: skeleton and loaded element measured at the same top and height. A header reflow on throttled phones when fonts load shows up in layout-shift records with or without the lazy parts and is unchanged.

## After (same database and scripts, production build, 375 px, Fast 3G, 4x CPU; baseline rebuilt from the Phase 0 commit)

Navigation by bottom-bar tabs, ms (server requests), five legs, legs 3 and 4 are revisits:

| Role | Before | After |
|---|---|---|
| admin | 1414 ms (2) · 772 ms (1) · 721 ms (1) · 763 ms (1) · 792 ms (1) | 455 ms (0) · 786 ms (2) · 244 ms (0) · 744 ms (1) · 777 ms (1) |
| coach | 1382 ms (1) · 771 ms (1) · 686 ms (1) · 703 ms (1) · 747 ms (1) | 778 ms (1) · 182 ms (0) · 713 ms (1) · 177 ms (0) · 666 ms (1) |
| member | 1333 ms (1) · 701 ms (1) · 713 ms (1) · 747 ms (1) · 695 ms (1) | 1478 ms (1) · 691 ms (1) · 687 ms (1) · 710 ms (1) · 702 ms (1) |

Pages in the never-stale list still cost one request per visit by design; list and settings pages are served from cache in 120–290 ms.

First load, JS transferred in KB (gzip) up to 1.2 s after load, and load event in ms:

| Route | JS KB | Load ms |
|---|---|---|
| `landing /` | 173 → 165 | 3013 → 2983 |
| `login /login` | 172 → 164 | 3086 → 2993 |
| `dashboard /admin` | 179 → 182 | 3161 → 3013 |
| `daftar /daftar` | 266 → 178 | 3490 → 3088 |
| `/admin/reports` | 284 → 182 | 3725 → 2996 |
| `/admin/checkin` | 284 → 187 | 3700 → 3303 |
| `/admin/staff` | 272 → 185 | 3637 → 3227 |
| `/admin/profile` | 271 → 184 | 3776 → 3281 |
| `/admin/kasir` | 183 → 197 | 3265 → 3341 |

First-load JS per route from the analyzer, uncompressed KB:

| Route | Before → after |
|---|---|
| `/` | 550 → 520 |
| `/login` | 542 → 512 |
| `/admin` | 559 → 529 |
| `/member` | 559 → 528 |
| `/admin/reports` | 921 → 529 |
| `/admin/checkin` | 921 → 575 |
| `/admin/staff` | 951 → 575 |
| `/admin/profile` | 948 → 571 |
| `/daftar` | 944 → 566 |
| `/coach` | 951 → 575 |
| `/superadmin` | 935 → 556 |

Not lower: `/admin/kasir` is about 14 KB gzip higher in the transfer window (the page already imports sonner, and the toaster now loads beside it); the dashboard is 3 KB higher in the window because the test account has two clubs and loads the switcher chunk, while its route first-load is 30 KB lower. Recharts and the toaster are deferred, not removed, so total bytes on report and check-in pages are unchanged; they leave the critical path.
