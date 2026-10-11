# fix-hosted progress

## Status

- [x] Phase 0: preparation
- [x] Phase 1: migrations and cron
- [ ] Phase 2: hosted setup: hosted pending (blocked, see below)
- [x] Phase 3: docs and final checks (local part)

## Phase 0 result

- No `audit/` directory exists in this checkout, so minimal local probes are written for the items fixed here.
- Hosted: the Supabase account in this session lists one project, named `bugarswim`. No project named `swimma` is visible, so no hosted read or write was made. No `SUPABASE_ACCESS_TOKEN`, database URL or Supabase CLI is present in the environment.
- Local harness: PostgreSQL 16 with stub roles; a second layout with pgcrypto only in schema `extensions` is added for the proofs.

## Phase 1 done

- Migration 019 edited in place (never applied on hosted): the secret default no longer calls a schema-dependent function and `checkin_token_for` runs with `search_path = public, extensions`. All migrations apply on an empty database with pgcrypto only in `extensions` and with pgcrypto in `public`.
- New migration `20250101000024_privilege_hardening.sql`: table privileges, function execute grants, fixed `search_path` on every function without one, legacy plan tables closed to client roles (kept, because later migrations reference them). Default privileges adjusted for new tables and functions.
- Cron route: rejects when the secret is unset or empty, constant-time comparison.
- Local proofs on a layout with hosted-like default privileges: catalog counts before and after the migration, function and policy behavior tests unchanged (diff empty against the run without 024), cron cases (unset, empty, wrong, right secret).

## Phase 2: hosted pending

- Not run: no `swimma` project is visible to the session's Supabase account (it lists only `bugarswim`, which is not touched) and the environment holds no `SUPABASE_ACCESS_TOKEN`, database URL or Supabase CLI.
- To finish: set `SUPABASE_ACCESS_TOKEN` (and install the CLI) or `DATABASE_URL` for the `swimma` project in the environment, and make `swimma` visible to the Supabase MCP if advisors are to be run through it. Then follow `docs/DEPLOY.md` (move pgcrypto back to `extensions`, apply 012-024, parity and RLS checks, advisors saved in `audit/`, superadmin, `npm run seed:demo -- --hosted`).
- Done locally for that step: the hosted-format demo seed (`--hosted`) runs cleanly on a database migrated through 024.

## Phase 3 done (local part)

- `docs/DEPLOY.md` rewritten for the new layout, apply methods, status, mandatory `CRON_SECRET`, smoke test and rollback row for 024; README changelog added.
- Local checks: migrations 001-024 apply on an empty database with pgcrypto in `extensions` and with it in `public`; schema dumps of the two layouts differ only in the extension location; 39 tables, all with RLS; catalog queries show no `TRUNCATE`, `REFERENCES` or `TRIGGER` for client roles, no function executable by `anon` or `public` outside extensions, no function without a fixed `search_path`; client roles cannot read the retired plan tables while landing data tables stay readable; behavior tests for booking and cashier produce output identical to the run without 024 (including the anon section); cron route: unset or empty secret, wrong secret and missing header give 401, the right secret gives 200; `npm run build`, `npx tsc --noEmit` and `npm run lint` pass.
- Not verifiable locally: hosted migration list, hosted schema diff, hosted advisor comparison.

## Resume, second session

- Hosted `swimma` (ap-northeast-1, Postgres 17.6) is visible to this session's Supabase MCP; migration list stops at 011.
- pgcrypto moved back to `extensions` on hosted (no object depended on it).
- Local probes in `audit/` rerun against migration 024 on the seeded database: only the intended changes (client roles lose the retired plan tables, anon loses function execute, no TRUNCATE for client roles); every other result identical. Migrations 001-024 apply on empty databases with pgcrypto in `extensions` and in `public`.
- Phase 2 still blocked: no `SUPABASE_ACCESS_TOKEN` or `DATABASE_URL` in the environment, and the MCP cannot run migrations 012 onward. Set one of them for the `swimma` project to continue.
