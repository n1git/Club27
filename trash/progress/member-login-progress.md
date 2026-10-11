# member-login progress

Members sign in on the same `/login`, one account per person, memberships in many clubs, read-only portal gated by `member_portal`.

## Status

- [x] Phase 0: preparation and plan. OK received (defaults accepted).
- [x] Phase 1: database (`20250101000017_member_login.sql`)
- [x] Phase 2: auth and server
- [x] Phase 3: UI
- [x] Phase 4: cleanup and final checks

## Dependency note

`org-billing` is merged. `club-types` is not in the repo (no migration, no `terms`, no `requireModule`). On your instruction ("langsung ini aja") I proceed without it: a minimal `requireModule` and plain Bahasa wording, both easy to swap when `club-types` lands. Consequence: the gate checks only the global `platform_modules.status` (not a per-club setting).

## Phase 0 findings

### What exists (current `main`, `ba68ac0`)

- Roles: `admin`, `coach`, `receptionist`, `finance` (`lib/auth/roles.ts`: `roleHome`, `canAccessPath`, `ROLE_LABEL`, `STAFF_ROLES`). `proxy.ts` protects `/admin`, `/coach`, `/change-password` and uses `canAccessPath`.
- Login (`app/api/auth/login/route.ts`): owner lookup, then staff profile lookup, shared lockout (`failed_login_count`, `locked_until`) and generic error; account abstraction with `{table, key, id, passwordHash, ...}` so a third store fits.
- JWT claims `sub` (profile id), `app_role`, `tenant_id`, `org_id`, `email`, `full_name`; `createSession` in `lib/auth/session.ts`. `requireRole` (`lib/auth/guard.ts`) checks profile/tenant/owner active, `sessions_valid_after`, `must_change_password`.
- Identity: migration 012 `enforce_profile_identity` and `enforce_owner_email` plus unique index `profiles_login_email_idx on profiles(email) where owner_id is null`. Billing: `enforce_profile_billing` and `organization_internal_users` only look at admin/coach/receptionist/finance, so a `member` profile is neither gated nor billed.
- RLS (013 and 016): `members` select/insert/update policies list roles explicitly; `bookings`, `subscriptions`, `invoices` policies are role-specific; `classes`, `locations`, `class_types`, `membership_packages`, `promo`, `tenants` selects are tenant-wide for any role, so a member already reads classes and active promo. `subscription_usage` (security invoker) joins `member_names`, which only returns rows for admin/receptionist/finance.
- Owner pattern to copy: `lib/auth/owner.ts` (`loadOwner`), `lib/actions/owner.ts` (`switchTenant`), `org_owners` columns and lockout fields; coach pages in `app/coach` and password reset in `lib/actions/accounts.ts`.

### Plan

**Migration `20250101000017_member_login.sql`** (new, never edits an applied one)
- `member_accounts(id, email unique + check lower, full_name, password_hash, is_active, must_change_password, failed_login_count, locked_until, last_login_at, timestamps)`; RLS on, all revoked from anon and authenticated.
- `profiles.member_account_id` (FK), role check adds `'member'`, check `(role = 'member') = (member_account_id is not null)`, unique `(member_account_id, tenant_id)`. `members.profile_id` unique, nullable, FK.
- `profiles_login_email_idx` recreated `where owner_id is null and member_account_id is null`.
- Identity triggers across the three stores: `enforce_profile_identity` rewritten (member profile: email equals the account email, no `owner_id`; staff profile: email not in `org_owners` or `member_accounts`), `enforce_owner_email` also checks `member_accounts`, new trigger on `member_accounts` checks `org_owners` and non-member profiles. 23505 on conflict, advisory lock per email as before.
- Deferred constraint trigger on `profiles`: a member profile must end the transaction with a `members` row whose `profile_id` points at it in the same tenant; a `members` trigger checks `profile_id` references a member profile of the same tenant.
- Helpers `current_member_id()` (security definer, revoked from public/anon, granted to authenticated) and `is_member()`: app role `member`, `is_active_user()`, and the member row active in the current tenant.
- `is_active_user()` rewritten: also joins `member_accounts` and requires `is_active`.
- Policies (role member, select only): own `members` row, own `subscriptions`, `invoices`, `bookings`. `profiles_update_self` recreated so it no longer applies to role member. No insert/update/delete policy for members anywhere.
- New view `my_subscription_usage` (security invoker, no `member_names`) for remaining sessions of the member's own session-pack subscriptions.
- `platform_modules.member_portal` set to `ready`.
- `activate_member_account(member_id, email, password_hash)` (service role only, security definer): checks the module is ready, locks the member row, refuses an inactive or already-linked member, creates the account (temporary password hash, `must_change_password`) or reuses the existing one, creates the club profile, sets `members.profile_id`; returns account id, profile id, whether the account was created.

**JWT and login flow**
- Claims unchanged plus app role `member`; `sub` is the member profile of the active club. Extra optional claim `club_pending: true` is set when the account has several clubs, so every member page except `/member/klub` redirects to the chooser until `switchClub` mints a normal session.
- Lookup order: `org_owners`, `member_accounts`, staff `profiles`; same rate limit, lockout, generic error, and the same message when no club is usable. A club is usable when the profile, the tenant and the `members` row are active. One usable club: JWT for it, go to `/member`. Several: JWT for the oldest, `club_pending`, go to `/member/klub`.
- `switchClub` (server action, `ActionState`): reads `member_account_id` of the session profile from the database, checks the target profile belongs to the same account and is usable, re-mints the JWT, redirects to `/member`.
- `changePassword` member branch updates `member_accounts`, clears `must_change_password`, sets `sessions_valid_after` on all of the account's profiles. `requireRole('member')` also checks the account is active and `must_change_password`, and the member row active.
- `roles.ts`: `member` with label "Anggota", home `/member`, `canAccessPath` allows `/member` only for members and blocks members from `/admin` and `/coach`; `proxy.ts` protects `/member`.

**Server and UI**
- `lib/modules.ts`: `requireModule(code)` (reads `platform_modules.status`), used by pages, actions and activation.
- Actions `activateMemberAccount` (admin; coach only for their own members, checked through the RLS client) and `resetMemberPassword`; readers for the member pages use the member's own RLS client.
- `/member`: active subscription with remaining sessions, invoices with status, upcoming classes, active promo. `/member/klub`: chooser with the club switcher in the shell. Member detail (admin) and "Anggota Saya" (coach) get "Aktifkan akun" and "Atur ulang kata sandi". Existing components only.

### Decisions I need from you (defaults apply if you just say OK)

1. **No `club-types`.** Minimal `requireModule` against the global module status and plain wording, as above. Per-club enablement is not possible until `club-types` exists.
2. **`members` has no email column.** Activation takes the email typed in the form; it is stored only on the account and profile, not on `members`.
3. **Password reset only for single-club accounts.** If any membership of the account is in another club, resetting is refused. Otherwise one club's staff could set a temporary password and sign in to the person's other clubs.
4. **One member profile per account per club** (as specified). Consequence: a parent using one email for two children in the same club cannot activate both; the second activation is rejected with a clear message. Members are mostly children, so this may bite; say if you want several member profiles per (account, club).
5. **Chooser claim `club_pending`** so a multi-club member sees nothing of any club before choosing (otherwise the JWT already points at one club).
6. **Existing hole, closed only for members:** `profiles_update_self` lets any role update its own profile row, including `is_active`, `must_change_password` and `sessions_valid_after`. I close it for role `member`; staff and coaches are untouched. Recommend a separate fix for them.
7. **`subscription_usage` is unusable by members** (it joins `member_names`), hence the separate `my_subscription_usage` view.
8. **No UI for deactivating a whole member account** (only via the database); deactivating the `members` row cuts that club from the existing member screens.
9. **Known limits, will go in the README:** activation reveals that an email already has an account; a temporary password known to one club's staff stays valid until the person's first login (they are forced to change it then); a coach or owner email cannot also be a member.

## Phase 1 done

- `supabase/migrations/20250101000017_member_login.sql`: `member_accounts`, `profiles.member_account_id`, `members.profile_id`, role `member`, identity triggers across owners / staff / member accounts, deferred link check, `is_active_user()` with account check, `current_member_id()` / `is_member()`, select-only member policies on `members`, `subscriptions`, `invoices`, `bookings`, `profiles_update_self` closed for members, `my_subscription_usage`, module `member_portal` set to `ready`, `activate_member_account` (service role only; error codes MP001 same-club duplicate, MP002 already activated, MP003 module not ready, MP004 inactive member).
- Applied on an empty DB and on 001-016 plus sample rows. Smoke checked in SQL: new account then second club linked to the same account; same-club duplicate and re-activation rejected; coach, owner and member emails reject each other in every direction; a member reads only its own member, subscription, invoice and booking rows, sees tenant classes, no cash ledger, no `member_names`, and every write is denied; a forged tenant claim sees nothing; deactivating the member row cuts only that club, deactivating the account cuts both; remaining sessions 8/1/7 from `my_subscription_usage`; anon denied.

## Phase 2 done

- Auth: `roles.ts` (`member`, label "Anggota", home `/member`, `/member` only for members, members blocked from `/admin` and `/coach`), `proxy.ts` protects `/member`, JWT/session carry optional `club_pending`, login route looks up owners, then member accounts, then staff profiles (same rate limit, lockout, generic error; several usable clubs mint the oldest with `club_pending` and go to `/member/klub`), `requireRole` checks the member account active, the member row active and `must_change_password` (account level), new `requireMemberClub` redirects a pending session to the chooser, `changePassword` member branch updates the account and revokes the account's sessions.
- Server: `lib/modules.ts` (`isModuleReady`, `requireModule` against the global `platform_modules.status`, since `club-types` is absent), `lib/data/member-clubs.ts` (usable clubs of an account), `switchClub`, `activateMemberAccount` (admin; coach only for own members, module gate), `resetMemberPassword` (refused when the account has a membership in another club), `lib/data/member-portal.ts` readers over the member's own RLS client. `resetUserPassword` no longer touches member profiles.

## Phase 3 done

- `ui-ux-pro-max` consulted (status shown with text labels, not colour alone). Existing components only (`AppShell`, `Table`, `Card`, `Badge`, `Select`, `TriggerDialog`); no new visual style.
- `/member`: greeting, subscriptions with remaining sessions for session packs, invoices with text status, upcoming booked classes, active promo. `/member/klub`: chooser (also reachable later as "Klub Saya"); the shell hides the club name and nav until a club is chosen, and shows a club switcher when the account has several clubs. `app/member/layout.tsx` gates with `requireRole('member')` and `requireModule('member_portal')`.
- `MemberPortalAccess` ("Aktifkan akun" with an email field, "Atur ulang kata sandi", temporary password shown once, the "Akun sudah ada, anggota login dengan kata sandinya" message): on the admin member detail page and modal (admin only, active members, module ready) and in the coach's "Anggota Saya" table through a dialog.
- Wording is plain Bahasa Indonesia (no `terms` helper exists).

## Phase 4 done

- README (auth model, identity rule, member activation in onboarding, limits, out of scope, changelog) and `CLAUDE.md` notes updated.
- Passed: `npm run build`, `npx tsc --noEmit`, `npm run lint`; migration 017 applies on an empty DB and on 001-016 plus sample rows; no `parent` / `child` / `club code` wording in app code.
- Verified in SQL (local Postgres with stubbed Supabase roles): a member account in two clubs of different organizations sees only the club named in the JWT, a forged tenant claim sees nothing; a member reads only its own `members`, `subscriptions`, `invoices`, `bookings`, sees tenant classes, cannot read the cash ledger, `member_names`, or any write (update, delete, insert and self-profile update all denied or no-op); the same email cannot exist as owner, coach and member in any order; deactivating the member row cuts only that club, deactivating the account cuts both; `activate_member_account` is rejected (MP003) while `member_portal` is not `ready`, no account is left behind; remaining sessions 8/1/7.
- Verified with the real `canAccessPath`: a member reaches only `/member*` and `/change-password`, never `/admin` or `/coach`; staff roles cannot reach `/member`.
- Not executed: the login route, lockout for member accounts, `switchClub`, activation and reset actions and the `club_pending` redirect run against a real Supabase/PostgREST (no PostgREST or Docker daemon here). Lockout and the generic error share the code path used for owners (same account abstraction), checked by reading only.
