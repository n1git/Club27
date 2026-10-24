# billing-invoices

Status: all phases done; migration 067 applied to hosted 2026-10-24 (version 20250101000067, existing renewal backfilled) and the code is pushed.

Goal: invoice and receipt (kwitansi) for subscription payments (renewal and seat purchase), laid out like the owner's samples (`Invoice-4BJVASVY-0002.pdf`, `Receipt-2382-0891-8129.pdf`, Stripe style), in Indonesian.

## Owner decisions (2026-10-24)

- Issuer: N-1 Labs, Jl. Ketileng Asri IV/E no.2, Semarang, Jawa Tengah 50727, Indonesia; brand Ruzz (logo, item names, getruzz.com).
- N-1 Labs is not a taxpayer (belum PKP, no NPWP): no PPN line, no tax column, no NPWP on either side. Total = price from `subscription_plans`.
- Language Indonesian.
- Bill to: organization name and owner email automatically; the owner may add a billing address and billing email.
- Payment layer stays Midtrans Snap (production since 2026-10-24); manual superadmin confirmation also issues a receipt.

## Phases

- [x] Phase 0: plan (this file). Owner said go on 2026-10-24.
- [x] Phase 1: migration 067 and SQL tests (local only). Commit f70b5da. `billing_phase9.sql` plus all 17 earlier suites pass on a fresh database (`supabase/tests/local/build.sh`, `run-tests.sh`). Backfill checked on a 066 database with a paid and a pending renewal. Billing address and email live on `organizations` (`billing_address`, `billing_email`), not a separate table, so purge and export need no change.
  - `billing_issuer` (one row, service role only): name, address, email, website, footer. Seeded with the decisions above.
  - `organization_billing_profiles` (organization_id, address, email); written only through a server action with `billing.manage`; added to `purge_organization` steps and the organization export.
  - `subscription_renewals` gains: `invoice_number` (unique, `INV-YYYYMM-NNNN`), `invoice_date`, `due_date`, `receipt_number` (unique, `RZ-YYYYMM-NNNN`), `issuer` (jsonb snapshot), `bill_to` (jsonb snapshot), `payment_method`.
  - Trigger before insert: invoice number from a gapless monthly counter (row lock), snapshots. Trigger when status becomes `paid`: receipt number. `request_renewal`, `request_seat_purchase` and `confirm_renewal` stay unchanged.
  - Issued documents are immutable except status, payment fields and `payment_method`; cancelled invoices keep their number and show "Dibatalkan".
  - Backfill numbers for existing rows (production data is test data).
- [x] Phase 2 (code held until 067 is applied): Midtrans details: the webhook stores the payment method (QRIS, VA bank, e-wallet, card brand + last 4); Snap gets item lines (plan, seats x months), 24 h expiry, 3-D Secure.
- [x] Phase 3 (code held until 067 is applied): pages. Checked with Next + PostgREST on a local database: login, `/admin/plan` history and billing form (save works), invoice and receipt pages, browser PDF print on one A4 page. Not checked: superadmin document page (needs TOTP login), a real Snap request and webhook (needs Midtrans).
  - `/admin/plan`: "Riwayat tagihan" (number, date, total, status, Invoice / Kwitansi links) and the billing profile form.
  - `/admin/plan/invoice/<id>` and `/admin/plan/receipt/<id>`: printable A4 pages matching the samples (header, numbers and dates, issuer and Bill to, amount line, item table with Qty, Harga satuan, Jumlah, subtotal and total, receipt adds Riwayat pembayaran), "Bayar" button on unpaid invoices, "Cetak / Simpan PDF" via the browser. Same pages reachable while the subscription is locked (under `/admin/plan`).
  - Superadmin: links to each document from the renewals list and a form for the issuer row.
- [x] Phase 4: CLAUDE.md notes and the FAQ "Belum ada" list (drop "kwitansi langganan") with its claim row.

## Open items for the owner

- Billing contact email for the header (for example billing@getruzz.com; needs a mailbox).
- If N-1 Labs becomes PKP later, PPN needs a follow-up migration (tax snapshot per document) and the landing price text changes.
- Email delivery of documents waits for `EMAIL_API_KEY`.
