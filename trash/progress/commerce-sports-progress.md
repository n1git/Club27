# commerce-sports progress

Products, orders, point of sale, manual payments, then sport club types (tennis, padel, pilates, yoga) on the shared core.

## Status

- [x] Phase 0: preparation and plan. OK given in the same message as the task ("ok, you decide"): defaults accepted.
- [x] Phase 1: commerce, database and server (`022_commerce.sql`)
- [x] Phase 2: products and POS UI
- [x] Phase 3: sport club types and dashboard (`023_sport_club_types.sql`)
- [x] Phase 4: cleanup and final checks

## Repository assessment

- Dependency: `resource-booking` is finished (all phases in its progress file, last commit `5f17105`). `main` is in step with `origin/main`.
- Latest migration is `20250101000021`; new ones are `022` (commerce) and `023` (club types).
- Money today: `invoices` paid by `mark_invoice_paid` write one `cash_ledger` row (`payment_received`, needs `invoice_id`). `cash_ledger` is append-only, tenant-scoped, readable by admin and finance, with a `cash_ledger_traceable` check that ties each category to its source column, and a trigger that checks the source belongs to the tenant. Clients can currently insert any ledger category that passes the check (admin and finance).
- Modules: `platform_modules` + `club_type_modules` + per-club overrides; effective modules via `club_has_module`. Admin nav and `requireModule` layouts are the pattern for gating.
- Terms: `club_types.terms jsonb` already exists since migration 020 and `getClubTerms` already reads it with defaults. There is no `termsFor`.
- Club types today: `swimming` and `gym` are `ready`. Registration and "Tambah klub" already list `ready` types from the table.
- Facilities and bookings exist (`resources`, `resource_bookings` with price per booking, written only by RPCs).
- Visual state: Table/Card/Badge/Dialog components, no cart or receipt component yet.

## Mismatches and assumptions

1. **Decision 9 is already done** (terms in the database since 020). Phase 3 only adds terms for the new types and keeps the neutral defaults; no `termsFor` is created because `getClubTerms` is the existing equivalent.
2. **"Common set".** In migration 018 the common set includes `classes`. The prompt adds `classes` explicitly for pilates and yoga, which implies the common set has none. Assumption: common = `members, plans, billing, cash_ledger, payroll, promo, member_portal`. Tennis and padel therefore have no `classes` module (their coaches still exist; lessons are bookings of a court). Pilates and yoga get `classes`. `swimming` and `gym` keep what they have and gain `pos` only.
3. **Ledger.** New category `order_payment` with nullable `order_id`; `cash_ledger_traceable` is replaced by a version that keeps the three old branches and adds the new one, so every old row stays valid. Added column `cash_ledger.order_id` is not visible through `cash_ledger_with_balance` (a `select *` view frozen at creation); the view is not changed because nothing needs `order_id` there.
4. **Ledger forgery risk.** Today an admin or finance client can insert any valid ledger row directly. With a new category, a client could insert an `order_payment` row for a real order without a payment. The client insert policy is narrowed to `manual_adjustment` only (existing UI only inserts that category; `payment_received` and `payroll` rows are written by security definer functions).
5. **Reports.** `report_revenue`, `report_revenue_by_program` and the dashboard "pendapatan" count paid invoices only, so POS sales do not appear there. Cash flow and the cash ledger do include them. Not changed (out of scope); POS sales appear in the new "Penjualan hari ini" KPI and on the orders page. Needs your call if you want them in the revenue report.
6. **Roles.** Admin and receptionist sell and void; finance reads orders, order items, payments and products; coach nothing. Product management (create/edit) admin only; receptionist reads products. Voiding is admin and receptionist as decided (any void restores stock).
7. **Booking lines.** A booking can be added as a line only if it is `confirmed`, belongs to the tenant, is not a class row, and is not already on another non-void order. Its member and the order's member must match when both are set. Price comes from `resource_bookings.price`. Paying (fully) sets `paid_at`; voiding an order clears `paid_at` again only if no other paid order holds it (a booking is on at most one non-void order, so clearing is safe). The booking is not cancelled by a void.
8. **Payments.** An order is `open` until payments sum to the total; each `add_order_payment` writes one `order_payments` row and one ledger entry; the order becomes `paid` when the sum reaches the total (overpayment is rejected; no change calculation beyond the UI hint). Stock decrements when the order becomes `paid`, in that transaction, locking product rows ordered by id. `create_order` therefore creates an `open` order without touching stock; selling in one step is `create_order` + `add_order_payment` called from the POS action. Voiding a `paid` order restores stock once and reverses the ledger with an `out` entry (`order_payment` cannot be `out` in the check as specified, see 9). Voiding an `open` order with partial payments is refused (pay or void must be clean).
9. **Reversal of payments on void.** The prompt says each payment creates a ledger `in` entry but not what a void does to money. Assumption: voiding a paid order is allowed, restores stock, and adds one `manual_adjustment` `out` ledger entry per payment with the reason "Pembatalan pesanan <nomor>" so the cash balance stays true and the ledger stays append-only. Void on `open` orders is only allowed when no payment exists. This needs your OK in the final line.
10. **Order number.** `<prefix><year>-<000001>` like `POS-2026-000001` per tenant per year from `order_counters` using `insert ... on conflict do update ... returning`, safe under concurrency. Unique `(tenant_id, number)`.
11. **Member view.** `/member` gets a read-only "Pesanan saya" page (paid orders, own `member_id` only) when `member_portal` is on and `pos` is enabled; members have select policies only on their own paid orders and items.
12. **Product stock and `track_stock = false`.** Untracked products never change stock. Editing stock by hand is allowed for admin (`stock_qty >= 0`).
13. **Money and rounding.** `numeric(14,2)`; line totals computed in SQL (`qty * unit_price`), never trusted from the client. Unit price for products comes from `products.price` at order time and is stored on the line (later price changes do not alter old orders).
14. **Club types.** New `ready` types: tennis, padel, pilates, yoga. `soon`: crossfit, martial_arts, dance, badminton, futsal, basketball, other. `other` as a registration choice stays hidden because it is `soon`. Terms: coach is "Pelatih" for tennis/padel, "Instruktur" for pilates/yoga; resource: Lapangan / Studio. Presets: tennis `court` "Lapangan Tennis {n}" x2, padel `court` "Lapangan Padel {n}" x2, pilates `studio` "Studio {n}" x1, yoga `studio` "Studio {n}" x1; slot 60 minutes, and capacity per kind in the onboarding form defaults (court 1, studio 12) are applied in code per `kind`, not per sport.
15. **Presets capacity.** `club_type_presets` has no capacity column. To keep "a sport is data" I add `default_capacity` (default 1) in migration 023 and use it in the onboarding form, which also fixes the lane-capacity point I raised last task (swimming lane 4, gym floor 20).
16. **Risks.** Money correctness (ledger, stock, void), concurrency (stock, order numbers), and regressions in the existing cash ledger page (needs the new category label). Mitigation: SQL tests for parallel orders and void, old ledger rows kept, label added.

## Plan

**022_commerce.sql**: `products`, `orders`, `order_items`, `order_payments`, `order_counters`, `next_order_number`, `resource_bookings.paid_at`, ledger category/`order_id`/check/trigger/policy change, RPCs `create_order`, `add_order_payment`, `void_order`, module `pos` (ready at end), `club_type_modules` for swimming/gym, RLS by role, execute revoked on internal functions.

**Phase 1 code**: validations, actions for products and orders (RPC-backed), readers.

**Phase 2 UI**: `/admin/produk`, `/admin/kasir`, `/admin/pesanan`, `/member/pesanan`, nav, receipt print view.

**023_sport_club_types.sql**: new club types, module mappings, terms, presets (+ `default_capacity`), `pos` mapping for the new types. Dashboard KPI cards.

**Phase 4**: README, CLAUDE.md, final checks, futsal-as-data proof.

## Decisions I need from you (defaults applied)

Assumptions 2, 5, 8, 9 (void reverses cash with manual adjustments) and 15.

## Phase 1 done

- Migration `20250101000022_commerce.sql`: module `pos` (mapped to swimming and gym, `ready` at the end), `products`, `orders`, `order_items`, `order_payments`, `order_counters`, `next_order_number`, `resource_bookings.paid_at`, ledger category `order_payment` with `order_id` (traceability check extended, old rows untouched, client insert narrowed to `manual_adjustment`), RPCs `create_order` (optional payments in the same transaction), `add_order_payment`, `void_order`, internal `order_record_payment` and `order_settle`; RLS: products read by admin, receptionist, finance and written by admin; orders, items and payments read-only for clients, a member reads only their own paid orders. Error codes `PS001`-`PS006`.
- Verified in SQL: split payment writes one ledger entry per payment (5 payments, 5 linked ledger rows), booking line sets `paid_at`, the same booking cannot join a second order, overpayment rejected, partial order can be completed and not voided, insufficient stock rolls back the order, ledger and order number, void restores stock once and writes manual `out` reversals, second void rejected, finance reads but cannot sell, coach sees nothing, receptionist cannot insert into `orders`, `products` or forge `order_payment` ledger rows, member sees only own paid order and items, another club sees nothing, module off gives PS001 with data kept, anon denied. Parallel: stock 12 with orders of 10 and 5 gave one success and one failure (whichever won; stock 7 or 2), 20 orders of 1 gave exactly 12 successes, stock 0, distinct order numbers. Migration applies on an empty database and on 001-021 with rows including old ledger rows.
- Server: `lib/commerce.ts`, `lib/validations/commerce.ts`, actions `products.ts` (create, update, active) and `orders.ts` (create order from a JSON cart with payments, add payment, void), readers `lib/data/commerce.ts`, cash ledger label "Penjualan Kasir".

## Phase 2 done

- `ui-ux-pro-max` consulted again (no match for print styles; fell back to Tailwind `print:` variants; inline error with `role="alert"`, 44 px targets, status as text, visible labels). Existing components and tokens reused.
- `/admin/produk` (admin): table with stock ("Habis" in text, not colour only), add/edit dialog, activate toggle. `/admin/kasir` (admin, receptionist): product tiles with search and category chips, unpaid priced bookings (adds the booking as a line and selects its member), member or customer name, cart with quantity buttons capped by stock, split payments with "Pas" for the remainder, over-payment blocked with a message, button label follows the state (pay, save unpaid), mobile floating cart bar. `/admin/pesanan` (admin, receptionist, finance): status filters, list; `/admin/pesanan/[id]`: receipt, print (app shell hidden in print), add payment for open orders, void with confirmation (finance sees no actions). `/member/pesanan`: own paid orders, read-only. Navigation items gated by `pos`.
- Checked in a real browser (PostgREST + built app + Chromium): product created, sale with a booking line and a cash + transfer split ends on the receipt, receipt PDF generated, void restores stock (12) and writes two reversal ledger entries, ledger shows "Penjualan Kasir", no horizontal scroll at 375 px on kasir, pesanan and produk, member sees only own order and cannot open `/admin`.

## Phase 3 done

- Migration `20250101000023_sport_club_types.sql`: `club_type_presets.default_capacity` (swimming lane 4, gym floor 20), club types `tennis`, `padel`, `pilates`, `yoga` (`ready`, with Indonesian terms) and `crossfit`, `martial_arts`, `dance`, `badminton`, `futsal`, `basketball`, `other` (`soon`), module mappings (common set + `resource_booking` + `pos`; pilates and yoga also `classes`), presets (tennis and padel courts x2, pilates studio capacity 12, yoga studio capacity 20), and `resource_utilization(from, to)` (security invoker). Applies on an empty DB and on 001-022 with rows.
- `getClubTerms` already read terms from the database (since 020), so no `termsFor` was added; registration and "Tambah klub" already list `ready` types from the table. The onboarding facilities step now uses the preset capacity.
- Dashboard: cards for bookings today, facility occupancy this week and sales today, each shown only when the club has the module.
- Checked in a real browser: registering a tennis, padel, pilates and yoga club from `/daftar` lists exactly the six ready types, lands on onboarding with the right preset (name pattern, count, capacity, kind), shows the right navigation (Jadwal only for pilates and yoga; Booking, Kasir, Pesanan, Produk for all), dashboard cards appear, and every navigation link of each club returns a page.

## Phase 4 done

- README (commerce, sports as data and how to add one, changelog 2026-10-06, out of scope wording) and `CLAUDE.md` updated.
- Passed: `npm run build`, `npx tsc --noEmit`, `npm run lint`; migrations 001-023 apply on an empty database and on one with sample rows; an old `payment_received` and `manual_adjustment` ledger row stays valid after 022.
- Stock: 20 parallel orders of 1 at stock 12 gave exactly 12 successes, stock 0, distinct order numbers. Orders of 10 and 5 at stock 12: exactly one succeeded (whichever won; stock 2 if the 10 won, 7 if the 5 won; the other failed with `PS003` and left no order, ledger row or number gap). Void restores stock once and a second void is rejected.
- Money: each payment wrote exactly one linked ledger row, split payments summed to the total, booking line set `paid_at`, voiding wrote matching `out` entries.
- Roles: receptionist sells, finance reads only, coach sees nothing, a member sees only own paid orders, no client insert into `orders`, `products` (non-admin) or forged `order_payment` ledger rows, other club sees nothing.
- Sport as data: in a throwaway database `futsal` was made ready with one UPDATE, five `club_type_modules` rows and one preset only; a futsal club registered from `/daftar`, got the Lapangan Futsal preset, created three facilities, saw booking and cashier, and every navigation link worked; the database was dropped afterwards. Navigation links of swimming, gym, tennis, padel, pilates, yoga and futsal clubs all returned pages.
- Disabling `pos` hides Kasir, Pesanan, Produk and the dashboard card, returns 404 on their pages and PS001 on the RPCs; data stays and returns when enabled again.
