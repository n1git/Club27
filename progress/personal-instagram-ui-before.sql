-- Hosted state before migration 068 (checked 2026-10-24). Everything else in 068 is new objects.

-- view social_people (replaced by create or replace, one column added at the end)
CREATE OR REPLACE VIEW public.social_people AS
 SELECT id,
    username,
    full_name
   FROM accounts a
  WHERE (is_active AND ((id = current_account_id()) OR is_related(id) OR is_group_peer(id) OR (EXISTS ( SELECT 1
           FROM (post_comments c
             JOIN posts p ON ((p.id = c.post_id)))
          WHERE ((c.account_id = a.id) AND (NOT is_blocked_pair(a.id)) AND ((p.account_id = current_account_id()) OR is_friend_of(p.account_id)))))));

-- reports constraint (widened by 068)
ALTER TABLE public.reports DROP CONSTRAINT reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check CHECK ((target_type = ANY (ARRAY['post'::text, 'comment'::text, 'account'::text, 'group'::text, 'event'::text])));

-- accounts.avatar_path did not exist; tables notifications, stories, story_views, dm_threads, dm_messages did not exist.
-- Rollback: drop those tables and functions, drop column accounts.avatar_path, restore the two statements above.
