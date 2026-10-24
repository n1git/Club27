# personal-instagram-ui

Depends on `personal-bottom-nav` and `bottom-nav-active`: both merged (c42861b, 6c6800b, 5f1cca8 on main).

## Phases

- [x] Phase 0: read code, clone reference, plan
- [x] Phase 1: migration 068, snapshot, hosted apply (data functions are written in the phase that uses them)
- [x] Phase 2: avatars, top bar, feed post card, comments sheet, carousel, skeletons
- [x] Phase 3: /notifications, unread badge, background mark-read
- [x] Phase 4: stories bar, viewer, create flow, cron route
- [x] Phase 5: chat (inbox, thread, background send, polling, report)
- [ ] Phase 6: profile grid, THIRD_PARTY.md, responsive and theme checks

## Plan

Storage: one private bucket `post-media` (webp, 5 MB) for everything, paths under `<account>/`: `avatar/<n>.webp`, `s/<id>.webp` (stories), `dm/<id>.webp` (messages). Existing `removeAccountPhotos` already removes the whole account folder. Messages from a deleted account's partner live in the partner's folder, so account deletion also collects the photo paths of every thread it belongs to.

Database (068, additive): `accounts.avatar_path`; `social_people` gains `avatar_path`; helpers `social_allowed()` (not banned, not minor) and `blocked_between(a, b)`; `notifications` + triggers; `stories`, `story_views`, `can_see_story`; `dm_threads`, `dm_messages`; RPCs `mark_notifications_read`, `unread_notification_count`, `create_story`, `delete_story`, `mark_story_viewed`, `story_tray`, `dm_inbox`, `dm_open`, `send_message`, `mark_thread_read`, `unsend_message`, `unread_message_count`, `expired_social_files`, `purge_social_expired`. Writes only through RPCs or security definer triggers; select policies for participants only. New policies and RPCs also check `social_allowed()` so minor or banned accounts get nothing even without the app layer.

Decisions inside the brief's room:
- Viewers of a story can see which stories they viewed through `story_tray()` (RPC), while `story_views` rows stay readable by the author only.
- `send_message` takes a client id so "Coba lagi" never duplicates a message.
- Unsend clears body and photo (file removed) and sets `deleted_at`.
- Read-only thread (friendship gone or block): readable by link, hidden from the inbox, cannot send.
- Unread badge for messages counts threads with unread messages.
- Notifications for the same reaction are deduplicated and removed again when the reaction is removed; a friend-request notification disappears once the request is answered.

## Reuse list (reference `the-current` @ 7d11e64, no LICENSE file; README states MIT)

Layout and markup ideas only, rewritten in Ruzz tokens, nothing pasted:
- `Components/Stories.tsx`: ring (gradient padding, inner gap, 64 px avatar) and the full-screen viewer shell.
- `Components/Post.tsx`: header row, square media, action row, likes line, caption.
- `Components/Comment.tsx`: comment row and sheet structure.
- `app/(main)/messages/**`: inbox row and bubble layout.
Not taken: models, `app/api/*`, auth, uploads, toast provider, desktop navbar, message model, reels.

## Phase 1 result

- Migration `20250101000068_instagram_social.sql` written and applied to a fresh local database (001 to 068, no errors). A 45-check SQL script (kept outside the repo) passed: notification triggers (request, accept, reaction toggle and dedupe, comment, never to self, nothing across a block, cleared on block), RLS (strangers and banned accounts read nothing, no client insert), stories (tray, seen, author-only views, 10 active limit, foreign path rejected, expiry, purge), messages (send, client-id dedupe, unread, read receipt, unsend, non-friend and banned cannot send, read-only after unfriend).
- Before-state snapshot: `progress/personal-instagram-ui-before.sql`.
- Applied to hosted `club27` as migration `instagram_social` after confirming hosted matched the snapshot (latest hosted version 067, no new tables). Afterwards the md5 of the 25 new function definitions on hosted equals local, security advisors show only the usual "security definer function executable by authenticated" notice for the new RPCs, like every existing RPC.
- Note: `reports_target_type_check` was dropped and recreated with `message` added (the only non-additive statement, needed for message reports).

## Phase 2 result

- Avatars: `accounts.avatar_path`, upload and remove on `/profile` (personal accounts only, client shrink then `sharp` 512 px webp square, old file removed), `Avatar` component with initials, `Person.avatarUrl` through `peopleMap` (also used by groups now).
- Top bar on mobile: brand on the left, theme toggle and logout moved into the Menu sheet (new `footer` slot); the heart and message icons are added in phases 3 and 5 through the new `topActions` slot.
- Feed: edge-to-edge post cards (header with avatar, relative time, options sheet; photo carousel with snap, counter, dots; optimistic heart; comments bottom sheet with optimistic add and delete; two-line caption with "selengkapnya"; workout summary block), `PostCardSkeleton` inside Suspense on home. Home puts the feed first and the dashboard cards after it on mobile, in a right column on desktop.
- Browser run on a production build (375, 320, 1280 px, light and dark): upload avatar, post with three photos, carousel scroll, like, comment, no horizontal scroll at 320. It caught one regression of mine (a `map(shrink)` passing the index as size), fixed.

## Phase 3 result

- `/notifications` (sections Baru, Minggu ini, Sebelumnya; reactions on one post grouped at read time; friend requests with Terima and Tolak; post thumbnail; row opens `/p/<id>`, `/g/<id>` or the profile). The page marks everything shown as read after render through `mark_notifications_read(before)` and keeps the "Baru" highlight until the next visit. Heart with unread badge in the top bar (mobile and desktop).
- Migration `069_reserve_social_routes.sql` (applied to hosted too, 12 hosted accounts, none clashing): `notifications`, `messages`, `stories` are reserved usernames, same list in `lib/username-suggest.ts`; `/notifications` and `/messages` added to `PERSONAL_PATHS`.
- Browser run (production build, 375 and 1280 px, light and dark): four events produce four rows and badge "4", page groups the two reactions, comment text shown, thumbnail present, Terima accepts, badge clears after the visit, "Baru" gone on revisit.

## Phase 4 result

- Stories bar at the top of home ("Cerita Anda" with plus badge, friends with an active story first, unseen ring = gradient of the Ruzz yellow, seen ring muted), full-screen viewer (segments, 5 s auto-advance, tap left or right, hold to pause, swipe down or X to close, continues to the next person, owner sees the viewer list and can delete with confirmation, reduced motion = no animation and no auto-advance). Create flow is a "Cerita" item in the "+" chooser and the plus badge; it uses the same background submit and toasts as the other quick adds.
- Cron route `/api/cron/social-cleanup` (daily at 03:00, in `vercel.json`): lists expired files with the same cutoff it later purges with, removes them from storage first, then deletes the rows (also 90-day notifications and 365-day messages). A failed storage removal aborts before the purge so the next run retries.
- Found while testing: React re-dispatches a nested `<dialog>`'s `close` through the React tree, so a sheet inside another dialog closed its parent; `BottomSheet` and the viewer now only react to their own `close`.
- Browser run (production build): create two stories, ring unseen, viewer segments, hold pauses, auto-advance, tap left and right, closes after the last story, views recorded, ring muted, swipe down, owner count and viewer list, delete removes the file, reduced motion, expiry hides the story, cron removes the file and the rows.

## Phase 5 result

- `/messages` inbox (avatar, preview, relative time, unread dot, refresh on focus) and `/messages/<username>` thread (two-sided bubbles, day separators, "Dilihat", photo button, background send with an at-once bubble then confirmed, "Gagal terkirim" with Coba lagi that reuses the client id so a retry never duplicates, tap a bubble for Tarik pesan or Laporkan pesan). The mobile thread is a full-screen layer over the bottom bar. Polling is a 4 s GET to `/api/dm` only while the tab is visible (plus on focus); Supabase Realtime was not used because the custom JWT claims are read by RLS through `current_account_id()`, which Realtime would not evaluate the same way.
- Paper-plane icon with unread thread count next to the heart. "Kirim pesan" on `/<username>` and in `/friends` rows. Read-only thread (no longer friends) is hidden from the inbox and has no composer. Message reports are accepted and shown on the superadmin reports page (type Pesan, remove deletes the message and its photo file).
- Account deletion also removes the photo files of every thread the account belonged to; the account export has `cerita`, `cerita_dilihat`, `notifikasi` and `pesan`.
- Browser run (production build): profile button, empty state, send, badge, inbox, "Dilihat", message arriving within seconds, photo message under the `dm/` prefix, failed send then retry exactly once, unsend, report, stranger and banned account get nothing, 320 px, read-only after unfriend.
