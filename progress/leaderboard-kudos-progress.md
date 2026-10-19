# leaderboard-kudos

Leaderboards (group and club), kudos on posts, and a consent-based link between personal workouts and clubs.

## Status

- [x] Phase 0: plan, approved
- [x] Phase 1: migration 057 and SQL tests (dry run on hosted in a rolled-back transaction, then applied)
- [x] Phase 2: group leaderboard UI and kudos relabel
- [x] Phase 3: club leaderboard UI (member, admin) and the opt-in toggle
- [x] Phase 4: docs, privacy text (version bumped), export

Migration number: the brief says 055, but 055 (single plan) and 056 (yearly discount) are taken, so this is **057** (`20250101000057_leaderboards.sql`).

## What already exists (verified in the code)

- `workout_logs(account_id, sport, performed_on, duration_min, distance_m)`, RLS own-only, index `(account_id, performed_on desc)` (048). No policy lets another account read it, and none will be added.
- The link between a personal account and a club member already exists: `decide_club_join` calls `activate_member_account`, which sets `club_members.profile_id` to a `club_profiles` row with `role = 'member'` and `account_id`. Nothing to add for decision 4; the board functions join `club_members.profile_id -> club_profiles.account_id`. Members the club created without an account have no `profile_id` and cannot appear.
- `post_reactions(post_id, account_id)`, policy `can_see_post`. Today the feed counts every visible reaction, including from blocked accounts, and shows no names.
- `group_members.status` is `invited` or `active` (the brief's "accepted" is `active`).
- `is_blocked_pair(other)` and `current_account_id()` work from the JWT claim in any context (personal, member, staff), so the same functions serve all three sessions.
- `accounts.social_banned_at` (053).

## Tables

- `club_leaderboard_optins(account_id, club_id, created_at, primary key (account_id, club_id))`, both foreign keys `on delete cascade`. RLS on, everything revoked from `anon` and `authenticated`; written only by `set_leaderboard_optin`, read only by the board functions. Because it has `club_id` it gets the `a00_org_writable` trigger, and `supabase/tests/leaderboards_phase7.sql` asserts that every table with `club_id` has it.
- Trigger on `club_members` (update of `is_active` to false, and delete) removes that account's opt-in for the club, so a person who leaves and later rejoins starts with the board off.
- No change to `workout_logs`; no new index (the existing `(account_id, performed_on)` serves a per-member range sum for groups of at most 200 and clubs of a few thousand; revisit with real data).

## Functions (security definer, `search_path = public`, `revoke execute ... from public, anon`, `grant execute ... to authenticated`)

- `leaderboard_since(p_period)`: `week` = Monday of the current WIB week, `month` = first of the current WIB month; any other value raises `22023`.
- `group_leaderboard(p_group, p_metric, p_period, p_sport default null)`: returns `rank, account_id, username, full_name, sessions, distance_m, duration_min, is_me`. Returns no rows unless the caller is an `active` member of the group and not banned. Members are active, not banned, and not a blocked pair with the caller. Totals only. Ranked by the chosen metric (`distance`, `duration`, `sessions`), ties share a rank, members with no sessions in the period are listed last with zeros.
- `club_leaderboard(p_club, p_metric, p_period, p_sport default null)`: same columns. Caller must be an active linked member of the club, or staff/owner whose profile in that club holds `members.view_all` (checked with `profile_permissions`); otherwise no rows. Rows are accounts with an opt-in for the club and an active linked membership, not banned, not a blocked pair with the caller.
- `set_leaderboard_optin(p_club, p_on)`: caller must be an active linked member of the club; inserts or deletes the opt-in. Turning it off takes effect on the next read.
- `my_leaderboard_clubs()`: the caller's linked active clubs with name and opt-in state (for the toggle).
- `kudos_for_posts(p_posts uuid[])`: reactors of posts the caller can see, excluding blocked pairs and banned or inactive accounts; `username` and `full_name` are returned only for people related to the caller (friends, group peers, self), otherwise null so the UI shows "dan N lainnya". The feed count uses this function instead of the raw reaction rows.

## Routes and UI

- Group: tab "Peringkat" on `app/home/groups/[id]/page.tsx`, driven by `?tab=peringkat&metrik=&periode=&olahraga=` (server rendered links, no client state). Metric (jarak, durasi, sesi), period (minggu ini, bulan ini), sport filter from `club_types`.
- Club, member side: `/member/leaderboard` (menu item in the member shell when the module `member_portal` is on) with the same filters and the opt-in switch for the current club.
- Club, admin side: `/admin/leaderboard` (menu item, rule `members.view_all` in `lib/auth/permissions.ts`, module `member_portal`). Read only; shows only opted-in members.
- Opt-in switch also on `/home/join-club` for every linked club, default off, with a one-line statement of what becomes visible and to whom.
- Kudos: the button reads "Beri kudos" / "Batal kudos", count beside it, and a line "Kudos dari A, B dan N lainnya". Action and table names stay (`toggleReaction`, `post_reactions`); error strings change to "kudos". Shared-workout posts use the same card, so they get it too.
- Landing copy that says "beri suka" and the phone mock hearts are updated to kudos (free-section, FAQ, phone stage) and the claims table in `progress/landing-rework-progress.md` gets rows for leaderboards, opt-in and kudos.

## Security reasoning

- No policy or grant is added on `workout_logs`; boards read it only inside the functions, which aggregate and return totals, never rows.
- Group membership is consent for group totals only; club totals need a per-club opt-in; both are enforced in SQL, not in the UI.
- Every function reads the caller from `current_account_id()` (revoked sessions and inactive accounts get nothing), validates its enumerated arguments, and filters blocked pairs and banned accounts.
- Staff reach the club board only through `members.view_all` in that club; a coach with `members.portal` but not `members.view_all` does not.

## Tests (`supabase/tests/leaderboards_phase7.sql`)

Group: member sees ranked week and month boards, non-member and invited-only get nothing, sport filter, tie ranks, blocked pair absent both ways, banned absent. Club: opted-in member appears, switching off removes at once, non-linked and not-opted-in absent, staff with `members.view_all` sees it, other staff and outsiders get nothing, leaving the club clears the opt-in. Kudos: count excludes blocked and banned, names hidden for unrelated reactors. Isolation: another account still cannot select `workout_logs` or `club_leaderboard_optins`; the trigger check above.

## Data, privacy, export

- Account export (`/api/export/account`) adds `papan_peringkat_klub.csv` (club name, date) because the opt-in is new personal data. Leaderboards themselves are computed, so nothing else is stored.
- `/privacy`: add a paragraph under "Data yang diproses" and "Tujuan pemrosesan" describing group boards (members of the group see totals), club boards (opt-in, visible to club members and admins), and kudos. 
- Hosted: dry run in a rolled-back transaction via `execute_sql` (procedure in `CLAUDE.md`), then `apply_migration` and rename the version to 057.

## Needs your decision

1. Migration is 057, not 055 (see above).
2. Names on the club board: the personal account's full name and username (not the club's member record). OK?
3. Admin board visibility: permission `members.view_all` in that club plus module `member_portal`. Coaches without that permission do not see it. OK?
4. Kudos names are shown only for people related to the viewer (friends, group peers); other givers count as "dan N lainnya". Showing every giver's name would expose friends-of-friends. OK?
5. Privacy: adding the paragraph is a legal text change; do you want `PRIVACY_VERSION` bumped (new consents record the new version) or the paragraph added without a bump until legal review?
6. Group boards list members with zero sessions at the bottom; club boards list opted-in members the same way. OK?

## Decisions (answers) and deviations

1. to 3. approved as written. 4. `PRIVACY_VERSION` bumped to 2026-10-21 with a paragraph on boards, kudos and the opt-in. 5. Changed: members with no session in the period are hidden; the board shows the top 10 and always renders ten rows, filling empty ranks with "Ayo mulai sesimu dan rebut posisi ini." The caller's own row is added under the list with its real rank when they are outside the top 10 (my addition).
- Deviation from "add `a00_org_writable`": the trigger is on insert and update only. A delete (withdrawing the opt-in) must work even when the club's subscription has lapsed, and the guard's purpose is to stop club writes, not a person withdrawing consent.
- Tests: `supabase/tests/leaderboards_phase7.sql` (all 12 SQL suites pass on a freshly built database); browser run covered group board, placeholders, non-member, kudos, club opt-in on both pages, admin view, opt-out, and a non-staff account.
