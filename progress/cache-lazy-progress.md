# cache-lazy progress

Status: Phase 0 done, waiting for OK.

- [x] Phase 0 — measure and plan
- [ ] Phase 1 — cache and invalidation
- [ ] Phase 2 — prefetch and live parts
- [ ] Phase 3 — lazy loading, after measurement

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

### Needs your OK

1. **Conflict with "second visit makes no server request".** The never-stale rule covers money, check-in, attendance and availability, and the dashboard, schedule, member home and booking pages all show some of them. Under the strict reading those pages (the main tabs of each role) are refetched on every visit; the 60 s cache then helps only the list and settings pages. The alternative is to cache them too and rely on refresh-on-focus and mutation purges, which can show a figure up to 60 s old. I recommend the strict reading. Which do you want?
2. `unstable_dynamicStaleTime` is not in this version's docs, only in its types and source. OK to use it? The fallback is a small client component that calls `router.refresh()` on mount for those pages (shows cached content for one round trip, then fresh).
3. `staleTimes.static = 60` (decision 1 said static keeps the default) is needed to cap `router.prefetch`. OK?
