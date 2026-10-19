# single-plan-plus

Replace Standard and Advanced with one plan, "27 Club Plus": code `plus`, Rp75.000 per seat per month, minimum 2 seats on every purchase, up to 5 clubs, 30-day trial of 1 seat.

## Status

- [x] Phase 0: plan, approved
- [x] Phase 1: migration 055 (dry run on hosted in a rolled-back transaction, then applied)
- [x] Phase 2: TypeScript
- [x] Phase 3: landing and sport pages
- [x] Phase 4: docs

## Migration 055 (`20250101000055_single_plan_plus.sql`)

- `subscription_plans.min_seats int not null default 1 check (min_seats >= 1)`.
- Upsert `plus` (name "27 Club Plus", price 75000, `club_limit` 5, `trial_days` 30, `trial_seats` 1, `yearly_free_months` 0.5, `grace_days` 365, `min_seats` 2, active).
- Move `organization_subscriptions.plan_code` and `subscription_renewals.plan_code` of `standard` and `advanced` to `plus`; delete the two old plan rows after nothing references them (both are foreign keys).
- `platform_quote`: reject a seat count below `min_seats` with errcode `22023`. `request_renewal`: same check on `v_seats` (first activation, renewal and a scheduled decrease). `request_seat_purchase` and `seat_quote` are untouched: they only add seats to an active subscription, which already has at least the minimum.
- Registration (`register_organization`, `register_organization_unverified`) stays a 1-seat trial and needs no change; the minimum applies when the first payment is requested.
- Club limit: the plan-change trigger rejects a plan whose limit is below the current club count unless `club_limit_override` is set. Organizations with more than 5 clubs and no override get `club_limit_override = club count` so the move succeeds and nothing is lost (decision 1 below). Existing overrides stay.

## Files touched

- `lib/pricing.ts`: `PlanCode` becomes `"plus"`, `PricingPlan.minSeats`, `computeQuote` clamps to the minimum.
- `lib/data/platform-pricing.ts`: select `min_seats`.
- `lib/validations/onboarding.ts`, `lib/validations/superadmin.ts` (`planEditSchema` code and a `minSeats` field), `lib/actions/subscription.ts`, `lib/actions/organization.ts`, `lib/actions/superadmin.ts` (`updatePlan`): plan code from `PLAN_CODES`, seat count validated against the plan's `min_seats` with a schema built per request (the number comes from the table, not from TypeScript).
- `lib/billing/renewals.ts`.
- `app/signup/page.tsx`, `components/shared/register-club-form.tsx`, `components/pricing/pricing-picker.tsx`, `components/subscription/renewal-form.tsx`: single plan, seat input minimum from the plan.
- `app/superadmin/(portal)/page.tsx`: plan label from the plan name, not a code check.
- `components/landing/pricing-section.tsx`, `components/landing/json-ld.tsx`, `app/sports/[code]/page.tsx` and `components/landing/sport-page.tsx` (price line), FAQ text in `components/landing/faq.tsx`.
- `scripts/seed-admin.ts` (`SEED_PLAN` default `plus`), `scripts/seed-demo.ts`.
- `supabase/tests/*.sql`: replace the plan codes in the test calls, add a minimum-seat test to `seats_phase4.sql`.
- Docs: `KAJIAN_PAKET.md`, `docs/ARCHITECTURE.md` (billing, "Seeded values"), `docs/CHANGELOG.md`, `docs/DEPLOY.md`, `README.md` (seed line), `CLAUDE.md` ("Dua paket" note), `PRODUCT_BLUEPRINT.md`.

## Landing claims to update in `progress/landing-rework-progress.md`

- "Harga per seat" rows: now one plan, price and minimum from `subscription_plans` (`price_per_seat_month`, `min_seats`).
- "Coba gratis N hari": `trial_days` = 30, shown as "Trial 1 bulan".
- Club limit: "Add up to 5 Club" reads `club_limit`; "Need more club? contact admin" points to the contact links; superadmin `club_limit_override` is the mechanism.
- "FUP 1.000 member/club": text only, no trigger or limit in SQL.
- Coupon: "Get your coupon code here" only links to the contact (WhatsApp or email); hidden if neither env var is set; no coupon system exists.
- Seat rule rows keep their proof (`organization_internal_users`, `enforce_seat_limit`) plus the new minimum (`platform_quote`, `request_renewal`).
- The FAQ answers about seats, trial and club limits are reworded to match.

## Plan card text (verbatim, English), numbers from the table

27 Club Plus / Rp75.000 / seat / bulan, minimal 2 seat / Add up to 5 Club* / Member Unlimited** / Trial 1 bulan*** / `*` Need more club? contact admin / `**` FUP 1.000 member/club / `***` Get your coupon code here (link). The price, minimum seats, club count and trial length come from the plan row; the "1.000" FUP is fixed text.

## Hosted rollout

`supabase` CLI is not installed in this environment, so `supabase db push --dry-run` cannot run here. Instead: compare `list_migrations` on the hosted project with the repo, run the migration inside a rolled-back transaction on a copy first (local database rebuilt from migrations 001 to 054, then 055, with the test suite), and only then apply to hosted with `apply_migration` and rename the version to 055.

## Needs your decision

1. Organizations with more than 5 clubs: I keep them with `club_limit_override = club count` (so Advanced orgs lose nothing). The alternative is to reject the move; there is no such organization if the data is only tests.
2. Active organizations that already have 1 seat: grandfathered until their next renewal request; the minimum applies to the next purchase, not retroactively.
3. During the 30-day trial the organization has 1 seat, so a second paid-role user is blocked until the first purchase of at least 2 seats. That is the current behavior with `trial_seats = 1`; say if you want 2 trial seats.
4. "Search finds no remaining Advanced or standard plan references except CHANGELOG history": migrations, `progress/*` history files and `progress/rbac-seat/rollback/042.sql` are immutable history and keep the old names. I will clean live code, tests, scripts and docs. Tell me if the progress files must be rewritten too.
5. JSON-LD offer: add `eligibleQuantity.minValue = 2` to the single offer. OK?

## Decisions (answers)

1. Dry run: `supabase` CLI needs credentials this environment does not have, so the dry run is the migration inside a rolled-back transaction on hosted via `execute_sql` (procedure in `CLAUDE.md`). It caught the old `subscription_plans_code_check` constraint before anything was applied.
2. Organizations over 5 clubs keep their club count as `club_limit_override` (checked with a local test: 7 clubs stay, an 8th is rejected with `SW004`).
3. Active organizations with 1 seat keep it until their next renewal request.
4. The trial keeps 1 seat.
5. Progress history files were reworded; migrations and `progress/rbac-seat/rollback/042.sql` keep the old names.
6. JSON-LD offer has `eligibleQuantity.minValue`.
