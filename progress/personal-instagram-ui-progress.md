# personal-instagram-ui

Depends on `personal-bottom-nav` and `bottom-nav-active`: both merged (c42861b, 6c6800b, 5f1cca8 on main).

## Phases

- [x] Phase 0: read code, clone reference, plan
- [ ] Phase 1: migration 068, types and data functions, snapshot, hosted apply
- [ ] Phase 2: avatars, top bar, feed post card, comments sheet, carousel, skeletons
- [ ] Phase 3: /notifications, unread badge, background mark-read
- [ ] Phase 4: stories bar, viewer, create flow, cron route
- [ ] Phase 5: chat (inbox, thread, background send, polling, report)
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
