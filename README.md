# 27 Club

Sports club platform (swimming, gym, tennis, padel, pilates, yoga and more) with two sides on one account system.

- Personal: anyone can sign up for free without an organization: profile and username, workout log and weekly goal, friends and a friends-only feed, groups and events, and joining a club as a member with a club code. Reports, blocking and moderation are built in.
- Business: members, scheduling, attendance, billing, cash ledger, coach payroll, facility booking, point of sale and gym check-in. An account upgrades to an organization (paid subscription); each organization owns one or more clubs with isolated data. Members sign in read-only.

Stack: Next.js (App Router) + TypeScript, Supabase Postgres with Row Level Security, Tailwind CSS v4, Vercel. UI in Indonesian; brand "27 Club" (assets in `public/brand/`, tokens in `app/globals.css`).

Public pages: `/` (landing), `/sports/<code>` (one page per ready club type, read from the database), `/signup`, `/login`, `/privacy`, `/terms`. Every login lands on `/home` (Beranda, Profil, Latihan, Teman, Grup, Klub, Upgrade, Pengaturan); from there an account enters its clubs or organizations. Roles: platform superadmin (`/superadmin`, including `/superadmin/reports` for moderation), club owner and staff (`/admin`), coach (`/coach`), member (`/member`).

## Local setup

1. Create a Supabase project (extensions `pgcrypto`, `btree_gist`, `pg_trgm`) and apply `supabase/migrations/` in order (`supabase db push` or the SQL editor).
2. Copy `.env.example` to `.env.local` and fill it in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only): Project Settings → API.
   - `SUPABASE_JWT_SECRET`: the legacy HS256 JWT secret (Project Settings → API → JWT Keys).
   - `CRON_SECRET`: any random string; Vercel Cron sends it as a bearer token.
   - `SUPERADMIN_JWT_SECRET`: signs the superadmin session (TOTP is mandatory).
   - Optional: `NEXT_PUBLIC_APP_NAME` (default "27 Club"), `NEXT_PUBLIC_SITE_URL` (required once a custom domain is attached: canonical, Open Graph, sitemap), `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`, `EMAIL_API_KEY` + `EMAIL_FROM` (invitation and password reset email), `REPORT_NOTIFY_EMAIL` (receives new-report notices), `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (captcha), `MIDTRANS_SERVER_KEY` + `MIDTRANS_IS_PRODUCTION` (online subscription payment).
3. Create the first organization, owner and club:
   ```bash
   SEED_TENANT_NAME="My Club" SEED_ADMIN_EMAIL=owner@example.com SEED_ADMIN_PASSWORD=ChangeMe123 npm run seed:admin
   ```
   Optional: `SEED_ADMIN_USERNAME` (default: from the email), `SEED_ORGANIZATION_NAME`, `SEED_PLAN` (`standard`|`advanced`), `SEED_PERIOD` (`monthly`|`yearly`).
4. `npm run dev`, then log in at `/login`.

## Scripts

`seed:admin` (first organization), `seed:superadmin` (first superadmin), `seed:demo` (demo data), `superadmin:reset-mfa`, `promo:remove-orphans`, `lint`, `build`. Database tests are plain SQL in `supabase/tests/`; run each against a fresh database with `psql -v ON_ERROR_STOP=1 -f`.

## Deploy

Link the repo to a Vercel project and set the same environment variables; `vercel.json` schedules two crons (monthly invoices, daily subscription expiry and reminders). Full steps: [`docs/DEPLOY.md`](docs/DEPLOY.md). Restore: [`docs/RESTORE.md`](docs/RESTORE.md).

## More

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): tenancy and auth model, club types and modules, booking, point of sale, check-in, navigation, landing, page layout, platform billing, out-of-scope list.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md): changes by date.
- [`CLAUDE.md`](CLAUDE.md): team notes and technical rules.
- `progress/`: one progress file per task (status, phases, measurements, landing claims table).
