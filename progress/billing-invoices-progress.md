# billing-invoices

Status: Phase 0 (plan) done, waiting for the owner's OK. Nothing built yet.

Goal: invoice and receipt (kwitansi) for subscription payments (renewal and seat purchase), laid out like the owner's samples (`Invoice-4BJVASVY-0002.pdf`, `Receipt-2382-0891-8129.pdf`, Stripe style), in Indonesian.

## Owner decisions (2026-10-24)

- Issuer: N-1 Labs, Jl. Ketileng Asri IV/E no.2, Semarang, Jawa Tengah 50727, Indonesia; brand Ruzz (logo, item names, getruzz.com).
- N-1 Labs is PKP; prices already include PPN. PPN 12% on DPP nilai lain 11/12 of the price before tax, so the effective rate is 11%: price before tax = round(total / 1.11), PPN = total - price before tax. Example 2 seats yearly Rp1.500.000: before tax Rp1.351.351, PPN Rp148.649.
- Language Indonesian.
- Bill to: organization name and owner email automatically; the owner may add billing address, NPWP and billing email.
- Payment layer stays Midtrans Snap (production since 2026-10-24); manual superadmin confirmation also issues a receipt.

## Phases

- [ ] Phase 0: plan (this file). Wait for OK.
- [ ] Phase 1: migration 067 and SQL tests (local only).
  - `billing_issuer` (one row, service role only): name, address, email, website, NPWP, PPN rate, DPP ratio, footer. Seeded with the decisions above. Rates are data, not code.
  - `organization_billing_profiles` (organization_id, address, npwp, email); written only through a server action with `billing.manage`; added to `purge_organization` steps and the organization export.
  - `subscription_renewals` gains: `invoice_number` (unique, `INV-YYYYMM-NNNN`), `invoice_date`, `due_date`, `receipt_number` (unique, `RZ-YYYYMM-NNNN`), `tax_rate`, `dpp_ratio`, `subtotal_before_tax`, `tax_amount`, `issuer` (jsonb snapshot), `bill_to` (jsonb snapshot), `payment_method`.
  - Trigger before insert: invoice number from a gapless monthly counter (row lock), snapshots, tax split. Trigger when status becomes `paid`: receipt number. `request_renewal`, `request_seat_purchase` and `confirm_renewal` stay unchanged.
  - Issued documents are immutable except status, payment fields and `payment_method`; cancelled invoices keep their number and show "Dibatalkan".
  - Backfill numbers for existing rows (production data is test data).
- [ ] Phase 2: Midtrans details: the webhook stores the payment method (QRIS, VA bank, e-wallet, card brand + last 4); Snap gets item lines (plan, seats x months), 24 h expiry, 3-D Secure.
- [ ] Phase 3: pages.
  - `/admin/plan`: "Riwayat tagihan" (number, date, total, status, Invoice / Kwitansi links) and the billing profile form.
  - `/admin/plan/invoice/<id>` and `/admin/plan/receipt/<id>`: printable A4 pages matching the samples (header, numbers and dates, issuer and Bill to, amount line, item table with Qty, Harga satuan, PPN, Jumlah, totals with PPN line and the DPP note, receipt adds Riwayat pembayaran), "Bayar" button on unpaid invoices, "Cetak / Simpan PDF" via the browser. Same pages reachable while the subscription is locked (under `/admin/plan`).
  - Superadmin: links to each document from the renewals list and a form for the issuer row.
- [ ] Phase 4: landing and plan card say "sudah termasuk PPN"; claim table rows; CLAUDE.md notes.

## Open items for the owner

- N-1 Labs NPWP (printed in the header; shown empty until filled in superadmin).
- Billing contact email for the header (for example billing@getruzz.com; needs a mailbox).
- These documents are commercial invoices and receipts, not a Faktur Pajak. A PKP must still issue the e-Faktur in Coretax for each sale; customers that credit input tax need it.
- Email delivery of documents waits for `EMAIL_API_KEY`.
- Local test environment must be rebuilt in this container (Postgres with the Supabase shim) before Phase 1 tests.
