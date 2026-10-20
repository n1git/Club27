# Deploy checklist

Target: Supabase project `swimma` (Postgres 17) and the Vercel project. Nothing here touches Vercel; the Vercel steps are for the owner.

## 1. Database

Order matters: deploy the application code first, then apply migrations 012 and later (owners move to `org_owners`, parent role is removed, subscriptions move to the organization).

### pgcrypto

The hosted project keeps `pgcrypto` in schema `extensions`. Migration 019 works with that layout (its functions use `search_path = public, extensions`), so no extension has to be moved. If an earlier setup moved it into `public`, move it back once, before applying the remaining migrations:

```sql
alter extension pgcrypto set schema extensions;
```

`btree_gist` and `pg_trgm` stay in `public` on purpose: indexes and exclusion constraints depend on them, so the advisor keeps listing "extension in public" for these two.

### Applying

Prefer a CLI or SQL connection, not the Supabase MCP (it holds SQL that contains top-level `DROP` or `DELETE` for interactive confirmation and stalls).

- Supabase CLI: set `SUPABASE_ACCESS_TOKEN` in the environment, then `supabase link --project-ref <ref>` and `supabase db push`. Hosted rows for 001-011 were recorded with timestamp versions; run `supabase migration list` first and, if the versions differ from the file names, `supabase migration repair --status applied <version>` for each applied file before pushing.
- Direct connection: with `DATABASE_URL` (the project's connection string) run each file of `supabase/migrations/` in numeric order with `psql -v ON_ERROR_STOP=1 -f <file>`.
- SQL editor: paste each file in numeric order, one at a time.

Migrations are not idempotent; apply each once. Do not edit an applied migration; add a new one.

### Status

| Range | State on the hosted project |
|---|---|
| 001-011 | Applied; pgcrypto is back in `extensions` |
| 012-032 | Applied through the Management API (2026-10-11); the migration history table lists only 001-012, so run `supabase migration repair --status applied` for 013-032 before the next `supabase db push`. Migration 012 ran without its data backfill block because the database was empty. |
| 033 | Applied 2026-10-11 through the MCP (`apply_migration`); the history table records it as version `20261011215359` (`usernames`), so repair the history before the next `supabase db push`. Existing accounts got `orgowner`, `coach`, `member` and `superadmin`. Usernames: adds `username` to `org_owners`, `member_accounts`, staff `profiles` and `superadmins`, backfills it from the email local part, and adds `p_username` to `register_organization`, `register_organization_unverified` and `activate_member_account`. Older app code keeps working against it, so apply it before or with the deploy that adds username login. |

Migration 024 sets the privileges of the public schema: no `TRUNCATE`, `REFERENCES` or `TRIGGER` for `anon` and `authenticated`, execute on functions only for `authenticated` and `service_role`, a fixed `search_path` on every function, and no client access to the retired plan tables. New functions follow the same defaults; a helper that row policies call must be granted to `authenticated` explicitly if it was created with a revoke.

### After the last migration

1. `select count(*) from pg_tables where schemaname = 'public'` must equal the local count (44 tables) and `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity` must return 0.
   - Migration 030 adds length, date and period checks. If existing rows break one of them, that check is skipped with a `WARNING` naming it; correct those rows and add the check by hand with the definition from the migration.
2. Run the Supabase security and performance advisors; expect "extension in public" for `btree_gist` and `pg_trgm` only.
   - Catalog check: no row for `anon` or `authenticated` in `information_schema.role_table_grants` with privilege `TRUNCATE`, `REFERENCES` or `TRIGGER`, and `select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')` returns only extension functions.
   - Move pgcrypto back to `extensions` if it was moved (see above).
3. Create the first superadmin: `npm run seed:superadmin` with `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` (12+ characters) and optionally `SEED_SUPERADMIN_USERNAME` (default: from the email) and the service role key in the environment. The first login at `/superadmin/login` enrols an authenticator app and shows eight single-use recovery codes once.
4. Lost authenticator: `npm run superadmin:reset-mfa -- <email>` (service role key in the environment) clears the authenticator and recovery codes and ends every session of that platform admin; enrolment is required at the next login.

## 2. Environment variables (Vercel)

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings, API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings, API (legacy anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings, API (server only) |
| `SUPABASE_JWT_SECRET` | Project Settings, API, JWT Keys, legacy secret. The app signs its own HS256 tokens, so the legacy secret must stay enabled. |
| `CRON_SECRET` | Any long random string (mandatory). The cron route answers 401 to every request while it is unset or empty, and compares the header against `Bearer ${CRON_SECRET}` in constant time. |
| `SUPERADMIN_JWT_SECRET` | Long random string (mandatory), different from `SUPABASE_JWT_SECRET`. Signs platform admin sessions (12 hours, revocable) and encrypts their authenticator secrets; changing it ends every platform admin session and requires an MFA reset. |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION` | Midtrans server key (sandbox `SB-Mid-server-...` or production) and `true` only for production. With the key set, owners pay renewals through Midtrans Snap and the subscription activates from the notification at `/api/payments/midtrans` (signature checked, status re-read from the Midtrans API, amount compared). Set that URL as the Payment Notification URL in the Midtrans dashboard; while Vercel Authentication protects the domain, append `?x-vercel-protection-bypass=<secret>`. Without the key, renewals stay on manual superadmin confirmation. |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Resend API key and a verified sender (for example `Swimma <noreply@domain>`). With both set, a new club stays unverified until the owner opens the emailed link (single use, 24 hours) and no session is issued before that. Without them registration signs the owner in immediately and the server logs a warning. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile keys for the registration captcha. Without them the captcha is skipped and the server logs a warning. |
| `NEXT_PUBLIC_SITE_URL` | Public base URL, for example `https://27club.id` (no trailing slash). Used in verification links and, for search engines, in canonical URLs, Open Graph tags, `sitemap.xml`, `robots.txt` and the structured data. Required once a custom domain is attached; while it is empty the `*.vercel.app` production URL is used, so search engines would treat that address as the original. |
| `NEXT_PUBLIC_APP_NAME` | Optional |

Vercel Authentication is on by default for the project; turn it off only when the site should be public.

Client IP for rate limits is read only from `x-real-ip`, which Vercel sets on every request. Behind another proxy, make sure it overwrites that header.

Pages send a Content-Security-Policy with a per-request nonce (`script-src 'nonce-…' 'strict-dynamic'`); every page renders dynamically for that reason.

### Custom domain and search

1. Attach the domain in Vercel, set `NEXT_PUBLIC_SITE_URL` to it and redeploy (the value is read at build time).
2. Redirect the `*.vercel.app` production address to the custom domain permanently so only one version stays indexable.
3. Open `/robots.txt`, `/sitemap.xml` and view the source of `/`: the canonical, `og:url` and sitemap addresses must show the custom domain.
4. Add the domain in Google Search Console, submit `/sitemap.xml`, and check Core Web Vitals once data appears. The landing page is rendered on every request (per-request CSP nonce and a session check), so the HTML is not cached by the CDN.
5. Keep `NEXT_PUBLIC_APP_NAME` at "Ruzz" (or unset) so titles read correctly.

## 3. Smoke test

1. Open `/` and confirm the pricing section shows "Ruzz Plus" with Rp75.000, minimal 2 seat (needs migrations 014 and 055).
2. Register a club at `/signup`, land on `/admin/onboarding`.
3. Log out, log in at `/login`, open `/admin`.
4. Log in at `/superadmin/login` with the seeded superadmin and activate the organization.
5. `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/generate-invoices` returns `{"generated": n}`; without the header or with a wrong value it returns 401.
6. Sign in as a club admin and open `/admin/members`, `/admin/booking` and `/admin/pos` (these exercise the row policies for an authenticated user).

## 4. Demo data

`npm run seed:demo` builds fake clubs through the real SQL functions (`register_organization`, `create_tenant_for_owner`, the RPCs). All organizations carry the `[DEMO]` prefix.

- Local, full scale (five organizations, a 5,000 member club): `DATABASE_URL=postgres://... npm run seed:demo`.
- Small set for the hosted project: `npm run seed:demo -- --hosted > demo.sql`, then run the file in the SQL editor. Passwords are generated per run and written to `audit/seed-credentials.json` (untracked).
- Remove demo data: `npm run seed:demo -- --purge --hosted > purge.sql`, run it in the SQL editor (it contains `DELETE` statements).
- Re-running the seed against a database that already holds `[DEMO]` organizations does nothing.

## 5. Rollback notes

No migration has a down script. The project is empty, so the practical rollback is to reset the database (Project Settings, Database, reset) and re-apply. Per migration, what would have to be reversed by hand:

| Migration | Reverse |
|---|---|
| 001 | `drop extension btree_gist, pg_trgm`; keep `pgcrypto` |
| 002-009 | drop the tables, functions and views it created (in reverse order of creation) |
| 010 | drop `superadmins`, `platform_plans`, `platform_subscriptions`, the plan triggers and `platform_tenant_usage` |
| 011 | drop `auth_rate_limits` and `hit_rate_limit`, drop `profiles.sessions_valid_after` |
| 012 | irreversible once data was backfilled (credentials move from `auth_credentials` to `org_owners`); restore from backup |
| 013 | irreversible (parent profiles and `parent_id` are deleted); restore from backup |
| 014 | drop the plan, subscription and module tables; the old billing tables are kept but unused |
| 024 | privileges only: re-grant what was revoked (table privileges, function execute for `public` and `anon`) and `reset search_path` on the functions; no data is touched |
| 015-023 | additive; drop the tables and columns they add (`coach_certifications`, staff roles, `member_accounts`, `club_types`, check-in, resources, orders) |
