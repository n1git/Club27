# profile-username progress

## Phase 0 — preparation (done, waiting for OK)

### Account types

| Account | Logs in from | Password / lockout | Relevant columns today |
|---|---|---|---|
| Owner | `org_owners` (then signs in as its per-club `admin` profile, `profiles.owner_id`) | `org_owners.password_hash`, `failed_login_count`, `locked_until` | `email`, `full_name`, `organization_id`, `is_active` |
| Staff: admin, coach, receptionist, finance | `profiles` where `owner_id is null and member_account_id is null` | `auth_credentials` (`profile_id`) | `email`, `full_name`, `phone`, `role`, `tenant_id`, `is_head_coach`, `specialization`, `session_rate`, `must_change_password`, `sessions_valid_after` |
| Member | `member_accounts`, one `profiles` row with role `member` per club | `member_accounts.password_hash`, lockout columns, `must_change_password` | `email`, `full_name`, `is_active` |
| Superadmin | `superadmins` (separate session, TOTP) | `superadmins.password_hash`, lockout columns | `email`, `full_name`, `totp_secret`, `totp_enabled_at` |

Supporting tables: `organizations.name`, `organization_subscriptions` (`plan_code`, `billing_period`, `status`, `trial_ends_at`, `current_period_end`), `tenants`, `coach_certifications` (`name`, `number`, `valid_until`), `members.coach_id`.

### Login and account-creation call sites

Login (email lookups):
- `app/api/auth/login/route.ts`: `org_owners.email`, then `member_accounts.email`, then `profiles.email` (`owner_id is null`), using the service role. Generic error `Email atau kata sandi salah`.
- `app/api/superadmin/login/route.ts`: `superadmins.email`.
- `lib/validations/auth.ts`: `loginSchema.email` (`z.email`).

Account creation:
- Registration `/daftar` → `app/api/onboarding/register/route.ts` → `register_organization` or `register_organization_unverified` (wraps the first).
- New club for an owner: `lib/actions/owner.ts` → `create_tenant_for_owner` (makes an admin profile for an existing owner, no new identity, so no username parameter is needed).
- Staff and coaches: `lib/actions/staff.ts`, `lib/actions/coaches.ts` → `lib/accounts/create.ts` (`createTenantAccount`: inserts `profiles` + `auth_credentials`).
- Member activation: `lib/actions/member-accounts.ts` → `activate_member_account` (creates the account, or links a new club to an existing account by email; the username only applies when a new account is made). UI: `components/members/member-portal-access.tsx`.
- Scripts: `scripts/seed-admin.ts` (`register_organization`), `scripts/seed-superadmin.ts` (direct insert), `scripts/seed-demo.ts` → `scripts/seed-demo.sql` (direct inserts into `profiles`, `auth_credentials`, `register_organization`, `activate_member_account`).
- Identity triggers: `enforce_profile_identity` (fires on email, owner_id, tenant_id, member_account_id), `enforce_owner_email`, `enforce_member_account_email`, all with `pg_advisory_xact_lock(hashtext(email))`.

### Migration outline (`20250101000033_usernames.sql`)

1. `username_is_valid(text)`: `^[a-z][a-z0-9._]{2,29}$` and not in (`admin`, `superadmin`, `support`, `root`, `system`, `club27`). Immutable, used by the `CHECK`s.
2. Columns: `org_owners.username`, `member_accounts.username`, `profiles.username`, `superadmins.username`, each `CHECK (username is null or username_is_valid(username))`.
3. Unique indexes: `org_owners(username)`, `member_accounts(username)`, `profiles(username) where owner_id is null and member_account_id is null`, `superadmins(username)`.
4. `suggest_username(p_email text, p_superadmin boolean default false)`: email local part lowercased, invalid characters removed, prefixed with `u` if it does not start with a letter, padded to 3 and cut to 30; a reserved or taken name gets `2`, `3`, … (shared namespace, or the superadmin table). Service role only; also used by the app to pre-fill forms.
5. Backfill in `created_at, id` order: owners, then staff profiles, then member accounts, then superadmins, each with `suggest_username`.
6. `not null`: `org_owners.username`, `member_accounts.username`, `superadmins.username`. `profiles`: `CHECK ((owner_id is null and member_account_id is null) = (username is not null))`, so only standalone staff carry one.
7. Shared namespace: add the username check to the three identity triggers. Each takes `pg_advisory_xact_lock(hashtext('u:' || username))` and refuses a name found in either other store with `23505` / `Username sudah dipakai`. Triggers also fire on `update of username`.
8. Fill-in triggers: a `before insert` trigger on `org_owners`, `member_accounts`, staff `profiles` and `superadmins` fills a null username from `suggest_username(email)`. Direct SQL inserts (`seed-demo.sql`, `seed-superadmin.ts`, old callers) then keep working, and the migration runs on an empty and on a seeded database.
9. Functions: add `p_username text default null` to `register_organization`, `register_organization_unverified` and `activate_member_account` (null → suggestion). The old signatures are dropped and re-granted to `service_role` only, with `revoke ... from public, anon, authenticated`.
10. Login lookup helper: none. The routes query by `username` or `email` with the service role, as today.

Zod: `lib/validations/username.ts` with the same regex and reserved list, used by every form and by `loginSchema` (`identifier` field: contains `@` → email rule, else username rule).

### `/profile` content checked against real columns

| Account | Shows (read-only) | Edits | Source |
|---|---|---|---|
| Owner | Email, organisation, plan and status, list of clubs | Full name, username | `org_owners.email`, `organizations.name`, `organization_subscriptions.plan_code/billing_period/status/trial_ends_at/current_period_end`, `tenants.name` where `organization_id`. The name is also copied to the owner's admin profiles (`profiles.full_name where owner_id`) so the club screens agree. |
| Admin, coach, receptionist, finance | Email, club, role label, head-coach flag | Full name, username, phone | `profiles.email/role/is_head_coach/phone`, `tenants.name` |
| Coach only | Specialisation, session rate, certifications | Nothing extra | `profiles.specialization`, `profiles.session_rate`, `coach_certifications` (own `coach_id`) |
| Member | Email, active clubs, primary coach per club | Username only | `member_accounts.email`; `profiles` with `member_account_id` → `tenants.name`; `members.coach_id` → coach `profiles.full_name` |
| Superadmin (`/superadmin/profile`) | Email, TOTP status | Full name, username | `superadmins.email`, `totp_enabled_at` |

Every edit is an update on the caller's own row, identified by the session id. It writes `logAudit` with the changed field names and old/new values (never passwords). A name or username change re-mints the session, because `full_name` is inside the JWT.

### Plan by phase

- Phase 1: migration 033 as above, `lib/validations/username.ts`, entry in `docs/DEPLOY.md`.
- Phase 2: both login routes and `loginSchema`; the "Username atau email" field on `/login` and `/superadmin/login`. Username field (pre-filled from `suggest_username`) on `/daftar`, staff, coaches and member activation. `seed-admin.ts` and `seed-superadmin.ts` get `SEED_*_USERNAME` (optional; suggestion when empty), and `seed-demo` is covered by the fill-in trigger. Duplicate → inline "Username sudah dipakai".
- Phase 3: `/profile` and `/superadmin/profile`, server actions in `lib/actions/profile.ts`, `KeyRound` replaced in `app-shell.tsx`, `/profile` in `PROTECTED_PREFIXES` and `canAccessPath`.
- Phase 4: lint, build, manual walkthrough on local DB, changelog.

### Open points (need your answer)

1. **Which shell does `/profile` render in?** Owners and staff use the admin shell (`/admin`), coaches `/coach`, members `/member`, each with its own layout and menu. A single top-level `/profile` needs its own layout that picks the shell and menu by role. The alternative is `/admin/profile`, `/coach/profile` and `/member/profile`, with `/profile` redirecting to the right one. I suggest `/profile` redirecting to the per-shell pages, because the menus and breadcrumbs then work unchanged.
2. **Top-bar control (visual):** the user's full name as a ghost link with the `UserRound` icon, the name hidden below `sm` (icon only, 44 px target). Or initials in a round badge. I suggest the name with an icon.
3. **Fill-in trigger:** a null username is filled automatically on insert (point 8 above), as a safety net for direct SQL and old callers. The forms still always send one. OK?
4. **Session rate:** should a coach see their own `session_rate` on `/profile`? It is their pay rate and is shown to admins today.

### Decisions after review (2026-10-11)

- Approved: `/profile` redirects to `/admin/profile`, `/coach/profile`, `/member/profile`; top bar shows the name with a `UserRound` icon (icon only below `sm`); the fill-in trigger is kept.
- Coach `session_rate` is shown masked as `***` with an eye button that reveals the amount.

## Phase 1 — database (done)

- `20250101000033_usernames.sql`: `username` columns with a format `CHECK`, unique indexes, `username_reserved`, `username_taken`, `suggest_username` (service role only), `enforce_username` trigger on the four tables (fill-in on insert, lowercase, reserved names refused with `Username tidak tersedia`, shared namespace refused with `23505` / `Username sudah dipakai`, advisory lock on `u:` + username), backfill in creation order, `not null` / `profiles_username_scope` check, `p_username` on `register_organization`, `register_organization_unverified`, `activate_member_account`.
- Deviation from the plan: the namespace check is a separate `enforce_username` trigger instead of code inside the three email triggers, so the email triggers stay untouched. Reserved names apply only to the shared namespace, so a superadmin can be `superadmin`.
- Tested on a local database: applies on an empty database and on one with owners, staff, a member account and a superadmin (colliding local parts get `2`, `3`, …). Duplicate across owner/member/staff refused, reserved name refused, bad format refused by the `CHECK`, new rows filled, owner/member profiles keep `username` null.
- `lib/validations/username.ts`: same regex and reserved list.
- `docs/DEPLOY.md`: row for 033.
