# landing-rework progress

Public landing page (`/`) for Swimma as one app for all sports clubs; every claim true and traceable.

## Status

- [x] Phase 0: preparation
- [x] Phase 1: foundations
- [x] Phase 2: content sections
- [x] Phase 3: pricing, FAQ and finish
- [x] Phase 4: final checks

## Repository assessment

- `app/page.tsx` is one 349-line server component: redirect for a signed-in session, live `getActivePlans`/`getModules`, `LandingPricing`, and fake content (hero figures "1.240+", "310", "27"; demo clubs "Kolam Renang Melati", "Aquatic Center Nusantara", "Sekolah Renang Ombak"; demo dashboard figures and names). Copy is swimming-only.
- `UsersInput` hint says internal users are "Pemilik, admin, dan pelatih"; the database counts owner, admin, coach, receptionist and finance (`organization_internal_users`, migration 016). This is a false statement shown on the landing and `/daftar`; fixed in Phase 3.
- Root metadata description says "Manajemen klub renang anak"; no sitemap, robots, Open Graph image or JSON-LD exist; `/privasi` and `/syarat` do not exist.
- `club_types` is readable by `anon` (migration 018), so the sports section can be data-driven. `subscription_plans` and `platform_modules` are already read for pricing.
- Another session (`audit-seed`) works on `main` in parallel; this task touches only landing files, `app/layout.tsx` metadata, new public routes, `.env.example`, README, CLAUDE.md and the pricing hint.
- `CLAUDE.md` still says the member portal and check-in modules are not built; both are `ready` (migrations 017, 019). Corrected in Phase 4 together with the fake-figures and legal-pages notes.

## Design decisions

- Skill run: `search.py "sports club management SaaS landing page" --design-system` returned "Vibrant & Block-based", red palette and Bebas Neue, aimed at fan/team sites, which does not fit a B2B tool. Per the skill's query contract I retried once with a B2B framing ("B2B SaaS management software for clubs, trust, feature showcase, pricing"); that result is the authority used here.
- Pattern: "Hero + Features + CTA" with CTA in the hero, the sticky header and at the bottom (deep CTA placement). Sections keep the user's order (header, hero with preview, sports, features by job, how it works, multi-club, pricing, FAQ, final CTA, footer).
- Color strategy: trust blue with a contrasting CTA. The existing brand tokens already are a trust blue (`--primary` #0369a1 light, #38bdf8 dark); kept unchanged. Contrast check of the tokens used for text: primary on white 5.9:1, primary-foreground on primary 5.9:1 (light) and #082032 on #38bdf8 9.3:1 (dark), muted-foreground on background 4.9:1 (light) and 6.8:1 (dark). No failure, so no token change.
- Style: the skill proposed Glassmorphism. Applied only where it does not cost contrast or speed: the sticky header uses `backdrop-blur` over a translucent background; cards stay solid (`bg-card`) because frosted cards over busy backgrounds risk contrast and add paint cost on mobile.
- Typography: the skill proposed Plus Jakarta Sans (mood: friendly, modern, SaaS, B2B). Kept the app's Lexend (headings) and Source Sans 3 (body), which match that mood and are already loaded by the app; adding a third family would cost page weight and split the brand between landing and app. Base 16 px body, 1.5 line height, headings 36-60 px with tight tracking.
- Effects: subtle, 150-300 ms hover transitions; the existing `fade-up` only under `motion-safe`. No animation library.
- Avoid (from the skill): excessive animation, dark mode by default (light stays the default; dark via the existing toggle).
- Pre-delivery checklist result (skill checklist, checked on the production build at 375, 768 and 1440 px in light and dark): no emoji icons, all icons are Lucide SVG with `aria-hidden` - pass; pointer cursor on buttons, links and FAQ summaries - pass; hover transitions 150-300 ms - pass; text contrast at least 4.5:1 - pass (axe found no contrast issue in either theme); visible focus for keyboard - pass; `prefers-reduced-motion` respected (hero preview animation is `none`, FAQ chevron has no transition) - pass; responsive 375/768/1024/1440 without horizontal scroll - pass after fixing the header (see Phase 4).

## Page outline and components (`components/landing/`)

1. `landing-header.tsx`: skip link target, brand, section links, theme toggle, Masuk, Daftarkan klub; mobile menu (client, native `<details>`-free button + panel, Escape closes).
2. Hero (`hero.tsx`) with `hero-preview.tsx` built from `Card`, `Badge`, `Table` and the booking/POS look, labelled "Contoh data".
3. `sports-section.tsx`: reads `club_types` (ready cards, soon "Segera hadir").
4. `features-section.tsx`: features by job (Anggota & paket, Jadwal & kehadiran, Fasilitas & booking, Check-in QR, Kasir & produk, Buku kas & gaji pelatih, Portal anggota, Peran & akses, Laporan & dasbor, Modul per klub; WIB and data isolation as trust notes).
5. `how-it-works.tsx`: four steps.
6. `multi-club.tsx`: organization, clubs, switcher, sample cards labelled "Contoh data".
7. `pricing-section.tsx`: copy from live plans around `LandingPricing`.
8. `faq.tsx`: native `<details>`.
9. `final-cta.tsx`, `landing-footer.tsx` (links to `/privasi`, `/syarat`, contact when set).
10. `json-ld.tsx`; `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `app/privasi/page.tsx`, `app/syarat/page.tsx`, `lib/contact.ts`.

## Claims table

| Claim on the page | Proof |
|---|---|
| Members, schedules, facility bookings, billing, cashier and cash book in one app (H1, supporting line, OG image) | modules `members`, `classes`, `resource_booking`, `billing`, `pos`, `cash_ledger` in `platform_modules` (migrations 014, 020, 022) |
| One club or several clubs under one organization | `organizations`, `org_owners`, `create_tenant_for_owner` (012, 018), `switchTenant` in `lib/actions/owner.ts` |
| Members are not limited | no member limit in `subscription_plans` or triggers (014); `organization_internal_users` excludes members (016) |
| Price is per internal user | `platform_quote`, `organization_internal_users` (014, 016) |
| "Coba gratis N hari" | `subscription_plans.trial_days` read live (`getActivePlans`) |
| Sports list, ready vs "Segera hadir", per-type terms and module summary | `club_types` (`status`, `terms`) and `club_type_modules` read live (018, 020, 023); module readiness from `platform_modules` |
| Club type chosen at registration; terms, modules and facility suggestions follow it | `register_organization(..., p_club_type)` (018), `club_types.terms` (020), `club_type_presets` (020, 023) |
| Packages monthly, quarterly, yearly or session packs | `membership_packages.billing_cycle` (002), `pricing_mode 'session_pack'` (009) |
| Recurring subscription invoices generated at the start of each month; session packs billed on purchase | `vercel.json` cron `0 0 1 * *` -> `app/api/cron/generate-invoices/route.ts` -> `generate_invoices_for_period` (003, 013); `create_invoice_for_session_pack_subscription` trigger (013) |
| Classes per location with capacity | `classes.location_id`, `capacity` (002) |
| Database rejects a coach scheduled in two classes at once | `exclude using gist (instructor_id ...)` (002) and `enforce_class_substitute` (016) |
| Coaches record attendance; substitute coach per class | `lib/actions/attendance.ts`, `classes.substitute_id` (016) |
| Facilities with opening hours, slots and capacity; overbooking rejected in the database, also under concurrent requests | `resources`, `resource_hours`, `enforce_resource_booking` with row lock and max overlap (021); 20-parallel test in `progress/resource-booking-progress.md` |
| Members can book by themselves from the portal | `book_resource_as_member` (021), `app/member/booking` |
| QR code keeps changing; each code valid 30 to 60 seconds; scanned with the member's phone | `checkin_token`, `checkin_window` 30 s, current and previous window accepted (019); README check-in section |
| Check-in stores no IP address or device data | `checkins` columns (019); CLAUDE.md check-in note |
| Sell products and bill bookings in one order | `order_items.kind in ('product','booking')` (022) |
| Stock cannot be sold beyond what is available | `order_settle` locks product rows, `PS003` (022); parallel test in `progress/commerce-sports-progress.md` |
| Cash, transfer or QRIS recorded manually, split payments, printable receipt | `order_payments.method` (022), split in `components/pos/pos-terminal.tsx`, `components/pos/receipt.tsx` + `PrintButton` |
| Invoice and cashier payments enter the cash book automatically | `mark_invoice_paid` (016) and `order_record_payment` (022) insert `cash_ledger` rows |
| Ledger entries cannot be changed or deleted from the app; corrections are new entries | no update/delete policy on `cash_ledger` (004, 016); client insert limited to `manual_adjustment` (022) |
| Coach payroll posted to the cash book | `create_payroll_run` inserts `payroll` ledger row (003, 016) |
| One member account for all clubs; members see their packages, invoices, schedule, bookings and orders | `member_accounts`, `profiles.member_account_id` (017); `app/member/page.tsx`, `app/member/booking`, `app/member/pesanan` |
| Roles: owner, admin, coach, head coach, receptionist, finance, member; each sees only its menus and data | `lib/auth/roles.ts` (`canAccessPath`), `profiles.is_head_coach` (016), RLS policies (013, 016, 017) |
| Reports: invoice revenue, outstanding, monthly cash flow, payroll cost; dashboard: bookings today, facility occupancy this week, sales today | `app/admin/reports/page.tsx`, `report_*` views (005); `app/admin/page.tsx` KPI cards, `resource_utilization` (023) |
| Each club can switch modules on or off, member module always on; menus follow; data kept | `set_club_module`, `tenant_module_overrides` (020), `getEnabledModules` in `app/admin/layout.tsx`; `members` rejected by check |
| All times shown in WIB | `lib/format.ts` (`Asia/Jakarta`), CLAUDE.md rule |
| Club data separated at database level; users read only the active club's data for their role | RLS by `current_tenant_id()` on all tenant tables (004, 013, 016) |
| Steps: register (club name, owner, plan, period) creates organization, owner and first club | `components/shared/register-club-form.tsx`, `register_organization` (014, 018) |
| Onboarding guides location, facilities with suggestions, first package; every step skippable | `app/admin/onboarding/page.tsx` (020) |
| Add staff with roles, register members, activate portal accounts | `app/admin/staff`, `app/admin/members`, `activateMemberAccount` (017) |
| Each club has its own sport type, members, staff, schedule and cash book | `tenants.club_type` (018); `tenant_id` on those tables |
| Owner switches club from the top menu without signing in again | `TenantSwitcher`, `switchTenant` (012) |
| One subscription per organization, counted from internal users of all clubs | `organization_subscriptions`, `organization_internal_users(p_org)` (014, 016) |
| Club limit per plan | `subscription_plans.club_limit` read live (014), enforced by `SW004` |
| Internal users are owner, admin, coach, receptionist and finance (active) | `organization_internal_users` (016); hint fixed in `components/pricing/pricing-picker.tsx` (it said owner, admin, coach only) |
| All available modules are included in every plan | no plan-to-module mapping exists; `platform_modules` only (014); `PlanCard` "Semua modul" |
| Club limit per plan, yearly free months, trial per plan | live `subscription_plans.club_limit`, `yearly_free_months`, `trial_days` (014) |
| Total recalculated on the server from current internal users | `platform_quote`, `serverQuote` in `lib/data/platform-pricing.ts` |
| Plan activated by the Swimma team after payment; no online payment | `organization_subscriptions.status 'pending'`, superadmin activation (`app/superadmin`); no gateway in code |
| Members and locations are not limited | no limit columns or triggers for `members`/`locations` (014, CLAUDE.md) |
| Member payments recorded manually by admin, receptionist or finance; cashier payments per method; every payment enters the cash book | `mark_invoice_paid` allows admin, finance, receptionist (016); `add_order_payment` (022); ledger rows as above |
| After an unpaid trial ends: data kept, club access locked until the owner renews and payment is confirmed | `isBillingLocked` in `checkSession` (`lib/billing/access.ts`), `expire_subscriptions` (035) |
| A "Segera hadir" type cannot be chosen at registration and appears automatically once ready | `register_organization` / `create_tenant_for_owner` require `status = 'ready'` (018); `getReadyClubTypes` in the form; this page reads `club_types` live |
| After registering you go straight to club setup | `app/api/onboarding/register/route.ts` redirects to `/admin/onboarding` (020 work) |
| Product visuals are sample data | `hero-preview.tsx`, `multi-club.tsx` labelled "Contoh data" |
| Per-sport page `/olahraga/<code>`: heading, one-line summary, feature list and term table for ready club types only | `club_types` (`status = ready`, `terms`), `club_type_modules` and `platform_modules.status` read live (`getPublicClubTypes`, `getModules`); the feature texts are the ones already listed above, filtered by the type's modules; an unknown or "soon" code renders not-found with `noindex` |
| Sitemap lists a page for every ready club type | `app/sitemap.ts` reads `club_types` live |
| "Coba gratis N hari" on a per-sport page | `subscription_plans.trial_days` via `getActivePlans` |

## Phase 1 done

- `ui-ux-pro-max` run again (skip link guidance: provide a skip-to-content link; mobile-first breakpoints). Header: sticky, translucent with backdrop blur (the one glass element), skip link "Langsung ke konten" to `#konten`, section links from `md`, theme toggle, Masuk and Daftarkan klub; below `md` a menu button (`aria-expanded`, `aria-controls`, 44 px) opens a panel with 48 px rows that closes on Escape (focus back to the button) and on link click. Footer: product links, account and legal links, contact only when an env var is set, WIB note.
- `Section` wrapper (id, `aria-labelledby`, eyebrow, balanced H2, intro, 64/96 px vertical rhythm, `max-w-6xl`, 16/24 px gutters, `scroll-mt-20` for the sticky header). Type scale: body 16-18 px, H2 30-36 px, H1 set in Phase 2.
- `lib/site.ts`: `SITE_URL` (`NEXT_PUBLIC_SITE_URL`, then the Vercel production URL, then localhost) and `getContact()` (`NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`), both documented in `.env.example`.
- Root metadata: `metadataBase`, title template, new description (all sports, not swimming only), Open Graph and Twitter tags; `app/opengraph-image.tsx` (1200x630, brand colors, no claims beyond the H1); `app/robots.ts` (app areas disallowed, sitemap link); `app/sitemap.ts` (`/`, `/daftar`, `/login`; legal drafts left out because they are `noindex`).
- `/privasi` and `/syarat` drafts with `noindex`, a visible "Draf" notice and no compliance claim.

### What the legal drafts assume

- `/privasi`: the stored data list matches the schema (org owners, staff profiles incl. optional phone, members incl. date of birth, address, notes, contact name and phone, member accounts, classes, bookings, attendance notes, subscriptions, invoices, orders, manual payments, cash ledger, payroll, check-ins without IP or device data, guest name and phone on bookings, customer name on orders, promo images in Supabase Storage, IP addresses kept briefly as rate-limit keys in `auth_rate_limits`); cookies: `app_session` (httpOnly, 7 days) and the theme in browser storage; services: Supabase (database, storage) and Vercel (hosting); no analytics or tracking; fonts are self-hosted by `next/font` (no request to Google at runtime); data is not deleted when access ends. It assumes the operator is the data processor and the club the controller, and does not name a legal entity, retention period or jurisdiction; these need your review.
- `/syarat`: describes the account model, roles, one email per identity, pricing per internal user, manual activation after payment, the effect of pending/expired/suspended/cancelled subscriptions (`SW003`, `tenants.is_active`), and that member payments are recorded manually. It does not set liability limits, governing law, refund rules or an operator name.

## Phase 2 done

- `ui-ux-pro-max` run again (landing domain: "Feature-Rich Showcase", one key message per card, CTA repeated after features and at the bottom; social proof left out because testimonials and logos are out of scope).
- Hero: H1 from decision 1, supporting line, primary CTA (trial days from live plans, else "Daftarkan klub"), secondary "Lihat fitur", note on unlimited members; product preview built from the app's `Card` and `Badge` with a dashboard KPI row, a booking slot grid and a paid order, labelled "Contoh data" (no image, so the H1 stays the LCP element).
- Sports: `getPublicClubTypes()` reads `club_types` and `club_type_modules`; ready types become cards whose description is built from their terms and ready modules, soon types are chips marked "Segera hadir". Empty state when the query returns nothing. Nothing per sport in code.
- Features by job: ten cards (members, schedule, facilities, QR check-in, cashier, cash book and payroll, member portal, roles, reports, modules per club) plus a WIB and data-isolation note; a card shows "Segera hadir" if its module is `soon`.
- How it works: four steps. Multi club: organization, club switcher, one subscription, club limit per plan from live data; sample list labelled "Contoh data" with neutral names.
- Fake figures and demo clubs removed (`grep` finds none of "1.240", "Kolam Renang Melati", "Aquatic Center Nusantara", "Sekolah Renang Ombak"). Pricing section temporarily keeps only the live picker; its copy, FAQ and final CTA come in Phase 3.

## Phase 3 done

- `ui-ux-pro-max` run again (pricing pattern: show actual totals and savings transparently and answer objections in the FAQ; keyboard guidance for disclosure widgets).
- Pricing: intro defines an internal user and states members are unlimited; three facts from live plan data (club limit per plan, yearly free months, trial per plan); the live picker and the `/daftar?plan=&period=&users=` handoff are unchanged; note on server-side recalculation and manual activation. Empty state links to `/daftar` when no plan loads. The pricing hint in `UsersInput` now lists all five internal roles (also visible on `/daftar`).
- FAQ: eight native `<details>` items with 56 px summaries, visible focus, chevron rotation disabled under reduced motion; answers use live plan data; "Hubungi kami" with links only when a contact env var is set.
- Final CTA on the primary color, JSON-LD `SoftwareApplication` with one `Offer` per live plan (`UnitPriceSpecification` per internal user per month), canonical `/`.
- Dead code: the old landing's fake sections, demo arrays and unused imports are gone with the rewrite; the `fade-up` animation is kept and now used only on the hero preview under `motion-safe` (not on the H1, so it cannot delay LCP).

## Phase 4 done

- README: landing section (structure, live data, how claims stay true, SEO, env vars), the two new env vars in local setup, changelog 2026-10-08. `CLAUDE.md`: removed the fictional-numbers note, replaced the "no FAQ / privacy / terms" note with the draft status, removed the stale "member portal and check-in not built" remark and the stale `swimming, gym` type list, added a landing note.
- Passed: `npm run build`, `npx tsc --noEmit`, `npm run lint`.
- Checked on the production build against a local database (PostgREST, Chromium):
  - axe: no violations of any impact at 375 and 1440 px in light and dark.
  - No horizontal scroll at 375, 768 and 1440 px in both themes. Fixed during the check: at 375 px the header's Masuk and Daftarkan klub buttons were not hidden (the `hidden` class lost to the button's own `inline-flex`), causing 25 px overflow; they now sit in a wrapper that is hidden below `sm`. Also: hero preview figures use a smaller size on phones, and the tenth feature card spans the full row at `lg`.
  - Keyboard: first Tab is the visible skip link and Enter moves to `#konten`; tab order follows the visual order (skip link, brand, section links, theme, Masuk, Daftarkan klub, hero CTAs, ...); focus ring visible; mobile menu opens with Enter, focus moves into it, Escape closes it and returns focus to the button; FAQ items open and close with Enter and Space. Reduced motion: hero preview animation is `none`.
  - Links: all 15 distinct hrefs on `/` resolve (anchors exist, routes return 200); no external link and no contact element when the contact env vars are unset.
  - `grep` for "1.240", "Kolam Renang Melati", "Aquatic Center Nusantara", "Sekolah Renang Ombak" finds them only in this progress file (where they are recorded as removed), not in code.
  - A signed-in owner visiting `/` is redirected (to `/admin`, as before). Picking Advanced, yearly and 5 users on the landing leads to `/daftar?plan=advanced&period=yearly&users=5`, and the form shows Advanced selected, yearly pressed and 5 users. Setting `club_types.futsal` to `ready` adds a futsal card on the next request; setting it back removes it.
  - `/robots.txt`, `/sitemap.xml`, `/opengraph-image` (PNG), `/privasi`, `/syarat` return 200; legal pages carry `noindex, follow` and the "Draf" notice; `/` has a canonical link, `og:image` and JSON-LD with one offer per live plan.
- Lighthouse on `/` (production build, local server):
  - Desktop: performance 100, accessibility 100, best practices 100, SEO 100; LCP 0.6 s, CLS 0.
  - Mobile with devtools throttling (real network and CPU throttling): performance 97-99, accessibility 100, best practices 100, SEO 100; LCP 1.0-1.8 s, CLS 0.02-0.04 (web font swap in the hero).
  - Mobile with the default simulated throttling: performance 95-97, LCP 2.6-3.0 s, CLS 0. This misses the LCP target. The observed LCP in the same runs was 0.11-0.21 s (the H1, first paint); the simulated value is inflated because on localhost the framework scripts (about 137 KB of the 169 KB JS) arrive and run before the first paint, so the simulator counts them in the LCP path. Tried and reverted: lazy-loading the toast library (gain 0.1 s), `display: optional` for the heading font (no gain), `experimental.inlineCss` (bimodal 2.2 or 2.9 s; global experimental flag, not kept). The landing's own client code is about 22 KB; the rest is the Next.js runtime. Needs a run against the deployed site to confirm; see the decision line in the final summary.

## 2026-10-15
- Owner removed the hero product preview ("Dasbor Admin" sample card): `hero-preview.tsx` and `sample-label.tsx` deleted, hero is now a single text column.
