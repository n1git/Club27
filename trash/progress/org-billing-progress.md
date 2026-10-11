# org-billing progress

Swimma's own billing moves from tenant to organization: two plans (Standard, Advanced), price per internal user, monthly or yearly commitment.

## Status

- [x] Phase 0: preparation and plan. OK received; all defaults accepted; push only to `main`.
- [x] Phase 1: database (`20250101000014_org_billing.sql`)
- [x] Phase 2: server
- [x] Phase 3: UI
- [x] Phase 4: cleanup and final checks

## Phase 0 findings

### Code that reads the old billing (all of it gets replaced)

- DB: `platform_plans`, `platform_subscriptions`, `organizations.max_tenants` (migrations 010, 012), triggers `members_enforce_plan_member_limit` (SW001/SW003) and `locations_enforce_plan_location_limit` (SW002/SW003) with their functions, `enforce_org_max_tenants` (SW004, reads `max_tenants`), views `platform_tenant_usage` and `platform_organization_usage`, functions `register_organization` (6 args with `p_trial_days`), `create_tenant_for_owner`, `create_tenant_row` (creates a per-tenant subscription).
- TS: `lib/data/platform-plan.ts` (retire; it also hard-codes DEFAULT_PLANS), `lib/actions/superadmin.ts` (`updateTenantSubscription`, `updateOrganizationLimit`), `lib/validations/superadmin.ts`, `lib/data/organization.ts` (`max_tenants`), `lib/actions/owner.ts` (`TRIAL_DAYS`), `lib/config.ts` (`TRIAL_DAYS`), `app/api/onboarding/register/route.ts`, `scripts/seed-admin.ts`, `lib/actions/types.ts` (`PLAN_LIMIT_CODES` has SW001/SW002), `lib/actions/{members,settings}.ts` (use `PLAN_LIMIT_CODES`).
- UI: `components/pricing/plan-cards.tsx`, `components/admin/plan-status-banner.tsx`, `app/page.tsx` (pricing section, "14 hari" copy), `app/daftar/page.tsx` and `components/shared/register-club-form.tsx`, `app/admin/page.tsx` (banner), `app/admin/klub/page.tsx` (limit text), `app/superadmin/(portal)/page.tsx`, `components/superadmin/{subscription-form,organization-controls}.tsx`.

### Plan

**Migration `20250101000014_org_billing.sql`** (one file; follow-ups would be 015+)
- `subscription_plans`, `organization_subscriptions`, `platform_modules` as in the task, with RLS: plans (active) and modules readable by anon and authenticated; `organization_subscriptions` readable only by admin profiles of that organization; every write is service role only. Seeds exactly as decided (standard 150000 / limit 3 / 30 days, advanced 250000 / unlimited / 0 days, 0.5 free months; modules ready/soon).
- `platform_quote(p_plan, p_period, p_users)` returns `users` (min 1), `unit_price`, `months` (1 or 12 − free months), `total`, `per_month` (total ÷ 1 or ÷ 12). Execute revoked from public/anon/authenticated, granted to `service_role`.
- `organization_internal_users(org)` (server-only): active `org_owners` + active profiles with `owner_id is null` and role admin/coach in any tenant of the organization. The owner's per-club admin profiles are not counted.
- Triggers: drop SW001/SW002 triggers and functions. One gate function raises `SW003` on: new/reactivated member, new club, new/reactivated internal user (non-owner admin/coach profile, new/reactivated owner), when the subscription is `pending`, `suspended`, `cancelled`, or `trial` past `trial_ends_at` (Asia/Jakarta). `SW004` on club insert: effective limit = `coalesce(club_limit_override, plan.club_limit)`; the trigger locks the subscription row `for update`. A before-update trigger on `organization_subscriptions` rejects a plan or override change that leaves the organization over the effective limit (so Advanced → Standard with 4 clubs fails, for owner and superadmin alike).
- `register_organization(org name, club name, owner name, email, hash, plan, period)`: org → subscription (Standard: `trial` for `trial_days`; Advanced: `pending`) → owner → club → owner admin profile. `create_tenant_for_owner(owner, name)` no longer creates a subscription. Old signatures dropped, new ones revoked from public/anon/authenticated and granted to `service_role`.
- `set_organization_status(org, status, actor, period_start, period_end)` (service role only): updates the subscription and flips `tenants.is_active` for every tenant of the organization (`pending`, `trial`, `active` → active; `suspended`, `cancelled` → inactive); sets `activated_at/by` on activation.
- `platform_organization_usage` is recreated: organization, plan, period, status, trial end, period end, effective club limit, clubs, members, internal users, total for the period, per month. Still service role only.
- `platform_plans`, `platform_subscriptions`, `organizations.max_tenants` stay in the schema, unused.

**Backfill (per organization)**
- Plan: `advanced` if any of its tenants had an old plan with no member limit and no location limit, otherwise `standard`.
- Period: `monthly`.
- Status: highest of its tenants' old statuses, ranked `active` > `trial` > `suspended` > `cancelled`.
- `trial_ends_at`: latest old trial date among its tenants; if the status is `trial` and no date exists, today (WIB) + the plan's `trial_days`.
- `current_period_start/end`: left null (no payment history to derive them from). The portal shows "Belum diatur".
- `club_limit_override`: old `max_tenants` when it differs from the plan limit, with the exception below.
- Organizations whose tenants have no old subscription row: `advanced`, `active`, note "Dimigrasi tanpa langganan lama", so they stay unlimited as today.
- Tenants stay as they are; only `set_organization_status` changes `is_active` afterwards.

**Server**
- `lib/pricing.ts` (pure formula, client-safe, takes plan rows from the table) and `lib/data/platform-pricing.ts` (plans, modules, subscription, internal-user count, server quote through `platform_quote`). `platform-plan.ts` is deleted and has no fallback prices.
- Owner actions: `changePlan` (plan, period; the DB trigger enforces the downgrade rule; status unchanged, no proration), `previewInternalUserCost` (server computes the monthly price change) used before `createCoach`.
- Superadmin actions: activate (with period dates, defaulting to +1 month or +1 year), suspend, cancel, extend trial, edit plan (price, club limit, trial days, yearly free months), set club-limit override.
- Registration takes plan and period, recomputes the quote on the server, never reads a price from the client.

**UI (Phase 3)**: invoke `ui-ux-pro-max` first, then reuse the existing `Button`/`Select`/`Input`/`Table`/`Card`/`Dialog` and the existing button-pair toggle pattern; no new visual style.

### Decisions I need from you (defaults apply if you just say OK)

1. **First club bypasses SW003.** Without it an Advanced organization (`pending`) could not even create its first club at registration. Rule: the gate does not apply while the organization has no club yet (also covers its first owner). Everything after that is blocked as decided.
2. **Advanced is read-only until paid.** Because Advanced starts `pending`, its owner can sign in and open the billing page but cannot add members, coaches or clubs until the superadmin activates it. This follows decision 6; flagging the consequence.
3. **`club_limit_override` on backfill, exception for Advanced.** Taken literally, every Advanced organization would get an override of 3 (old default `max_tenants`) and be capped at 3 clubs. Default: no override when the plan is Advanced (unlimited). Say "literal" to copy `max_tenants` regardless.
4. **Organizations with no old subscription row** become `advanced` + `active`, to preserve today's unlimited behavior. Production Supabase is empty, so this only matters for other databases.
5. **Suspended and cancelled also trigger SW003** (not only pending and expired trial), so a stale session cannot add anything to a suspended organization.
6. **Landing prices need the migration.** Prices live only in the table, so the landing pricing section is empty until 014 is applied (current production Supabase is empty and unmigrated). No hard-coded fallback.
7. **Client estimate vs server quote.** The live total on the landing and wizard uses the same formula in TypeScript on the plan rows read from the table; every authoritative figure (registration, plan change, price-change confirmation, superadmin) comes from `platform_quote`. I will test that both agree.
8. **No staff-admin creation exists today** (only coaches). The confirmation helper is generic and wired to coach creation; the DB gate already covers staff admins. I will not build a staff-admin form unless you ask.
9. **Branch:** the session assigns `claude/swimma-org-tenants-bk1kpc`, your task says `main` only. Following your task: everything goes to `main`.

## Phase 1 done

- `supabase/migrations/20250101000014_org_billing.sql`: `subscription_plans` (seeded), `platform_modules` (seeded), `organization_subscriptions` (RLS: org admins read, writes service role), backfill, `platform_quote`, `organization_internal_users`, SW001/SW002 triggers and functions dropped, `enforce_billing_gate` (SW003; no-op while the organization has no club) wired to members, club insert, non-owner admin/coach profiles and owner insert, SW004 trigger on club insert (locks the subscription row) and on plan/override change, new `register_organization(.., plan, period)`, `create_tenant_for_owner(owner, name)`, `set_organization_status`, recreated `platform_organization_usage`.
- Applied on an empty DB and on 001-013 + sample rows. Backfill result: advanced+active (old Pro and tenant D), standard+active with override 5 (old Starter, `max_tenants` 5), advanced+active "Dimigrasi tanpa langganan lama" (no old rows), standard+trial with the latest trial date (mixed trial/suspended).
- Smoke: quotes 600000 / 6900000 / 500000; Standard 4th club SW004; Advanced pending blocks club, member and coach (SW003); 1000 members on an active Standard org insert fine; internal users counted once per owner; `set_organization_status` flips all tenants.

## Phase 2 done

- `lib/pricing.ts` (pure formula, `formatRupiah`, types) and `lib/data/platform-pricing.ts` (plans and modules without any fallback prices, own subscription via RLS, `serverQuote` / `internalUserCount` via service role, `getOrganizationBilling`, `internalUserCostChange`).
- `lib/actions/subscription.ts`: owner `changePlan` (DB trigger enforces the downgrade rule), `previewInternalUserCost` (server computes the monthly change for the confirmation).
- `lib/actions/superadmin.ts`: added `activateOrganization` (period start defaults to today WIB, end computed in SQL), `setOrganizationStatus`, `extendTrial`, `setClubLimitOverride`, `updatePlan`. Validations added; status `pending` added.
- Register route takes plan, period, estimated users, recomputes the quote on the server and returns it; `createTenant`, `createCoach` and coach reactivation map SW003/SW004 to their message; `PLAN_LIMIT_CODES` is now SW003/SW004; `seed-admin` takes `SEED_PLAN` / `SEED_PERIOD`; `organization.ts` reads the club limit from the subscription.
- Deliberately left for Phase 3 (they still have UI importers, deleted together with the UI): `lib/data/platform-plan.ts`, `TRIAL_DAYS` in `lib/config.ts`, `updateTenantSubscription` and `updateOrganizationLimit`, old pricing/banner/superadmin components.

## Phase 3 done

- `ui-ux-pro-max` consulted (step indicator, visible labels, accessible toggle with `aria-pressed`; the toggle query had no database match, so general defaults were used). Only existing components and the existing button-pair toggle pattern; `AuthPageShell` got a `wide` option for the wizard and `NavItem` an `exact` option.
- Landing pricing: `components/pricing/{pricing-picker,landing-pricing}.tsx` (two plan cards from `subscription_plans`, monthly/yearly toggle, internal-user input, live total, module badges with "Segera hadir"). CTA carries plan, period and users to `/daftar`.
- `/daftar`: two-step wizard (plan, then owner and club) in `register-club-form.tsx`, preselects from query params.
- Owner: `/admin/klub/langganan` (status, plan, internal users with cost, total and per month, change-plan form, modules), nav item, link from `/admin/klub`; `SubscriptionBanner` on the dashboard (pending, trial, expired trial). Adding a coach first shows the server-computed monthly price change and asks to confirm.
- Superadmin portal: plans editor, per-organization card (plan, period, status, internal users, clubs vs limit, members, total and per month, period end with overdue flag, "Belum diatur" when empty) with activate-with-dates, status, extend trial, club-limit override and owner toggles.
- Retired and deleted: `lib/data/platform-plan.ts`, `plan-cards.tsx`, `plan-status-banner.tsx`, `subscription-form.tsx`, `TRIAL_DAYS`, `updateTenantSubscription`, `updateOrganizationLimit`. No code in `app components lib scripts` references `platform_plans`, `platform_subscriptions`, `max_tenants`, SW001 or SW002.

## Phase 4 done

- README (pricing model, onboarding, billing, changelog), `KAJIAN_PAKET.md` (replaced by the two plans), `CLAUDE.md` team notes updated.
- Passed: `npm run build`, `npx tsc --noEmit`, `npm run lint`.
- Migration 014 applies on an empty DB and on 001-013 + sample rows; backfill matches the rules (old Pro or tenant without old row -> advanced/active; old Starter with `max_tenants` 5 -> standard + override 5; mixed trial/suspended -> standard/trial with the latest trial date; Advanced never gets an override).
- Quotes: Standard monthly 4 users 600000, Standard yearly 4 users 6900000, Advanced monthly 2 users 500000; the TypeScript `computeQuote` and `platform_quote` agree (also 7 users yearly = 12075000).
- Internal users: owner + 2 coaches + 1 staff admin = 4; the owner's admin profiles in two clubs count once; members and a deactivated coach are not counted.
- Limits: Standard 4th club SW004, Advanced 5 clubs fine; two parallel club creations at limit minus 1: exactly one succeeded; Advanced to Standard with 5 clubs rejected (SW004), plan unchanged.
- Gates: Advanced `pending` and Standard with an expired trial get SW003 on a new member, club and coach, tenants stay active (sign-in unaffected, login route does not read the subscription); 1001 members inserted on Standard without error.
- Suspend: all tenants of the organization become inactive, an admin's data and subscription reads return 0 afterwards; anon cannot read `organization_subscriptions` but can read plans.
- Forged price: registration and plan change take only plan code, period and estimated users (extra keys are stripped); every figure comes from `platform_quote`.
- No code in `app components lib scripts proxy.ts` reads `platform_plans`, `platform_subscriptions` or `max_tenants`.
- Not run: the app against real Supabase/PostgREST (RPC calls, RLS-embedded reads such as `organization_subscriptions(...)` joins are type-checked and built only).
