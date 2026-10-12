# 27club

Multi-tenant sports club management platform (swimming, gym, tennis, padel, pilates, yoga and more): members, scheduling, attendance, billing, cash ledger, coach payroll, facility booking, point of sale and gym check-in. One deployment serves many organizations; each owns one or more clubs with isolated data. Members sign in read-only.

Stack: Next.js (App Router) + TypeScript, Supabase Postgres with Row Level Security, Tailwind CSS, Vercel.

## Local setup

1. Create a Supabase project (extensions `pgcrypto`, `btree_gist`, `pg_trgm`) and apply `supabase/migrations/` in order (`supabase db push` or the SQL editor).
2. Copy `.env.example` to `.env.local` and fill it in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only): Project Settings → API.
   - `SUPABASE_JWT_SECRET`: the legacy HS256 JWT secret (Project Settings → API → JWT Keys).
   - `CRON_SECRET`: any random string; Vercel Cron sends it as a bearer token.
   - `SUPERADMIN_JWT_SECRET`: signs the superadmin session (TOTP is mandatory).
   - Optional: `NEXT_PUBLIC_APP_NAME` (default "27club"), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`.
3. Create the first organization, owner and club:
   ```bash
   SEED_TENANT_NAME="My Club" SEED_ADMIN_EMAIL=owner@example.com SEED_ADMIN_PASSWORD=ChangeMe123 npm run seed:admin
   ```
   Optional: `SEED_ADMIN_USERNAME` (default: from the email), `SEED_ORGANIZATION_NAME`, `SEED_PLAN` (`standard`|`advanced`), `SEED_PERIOD` (`monthly`|`yearly`).
4. `npm run dev`, then log in at `/login`.

## Scripts

`seed:admin` (first organization), `seed:superadmin` (first superadmin), `seed:demo` (demo data), `superadmin:reset-mfa`, `promo:remove-orphans`, `lint`, `build`.

## Deploy

Link the repo to a Vercel project and set the same environment variables; `vercel.json` schedules the monthly invoice cron. Full steps: [`docs/DEPLOY.md`](docs/DEPLOY.md). Restore: [`docs/RESTORE.md`](docs/RESTORE.md).

## More

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): tenancy and auth model, club types and modules, booking, point of sale, check-in, navigation, landing, page layout, platform billing, out-of-scope list.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md): changes by date.
- [`CLAUDE.md`](CLAUDE.md): team notes and technical rules.
- `trash/`: retired prototype and finished progress logs; nothing imports it and it can be deleted.
