alter table accounts add column avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200);

create or replace view social_people as
  select a.id, a.username, a.full_name, a.avatar_path
  from accounts a
  where a.is_active
    and (
      a.id = current_account_id()
      or is_related(a.id)
      or is_group_peer(a.id)
      or exists (
        select 1 from post_comments c join posts p on p.id = c.post_id
        where c.account_id = a.id
          and not is_blocked_pair(a.id)
          and (p.account_id = current_account_id() or is_friend_of(p.account_id))
      )
    );

create function social_allowed() returns boolean as $$
  select current_account_id() is not null
    and exists (select 1 from accounts a where a.id = current_account_id() and a.social_banned_at is null)
    and not account_is_minor(current_account_id());
$$ language sql stable security definer set search_path = public;

create function blocked_between(p_a uuid, p_b uuid) returns boolean as $$
  select exists (
    select 1 from blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$ language sql stable security definer set search_path = public;

create function notify_allowed(p_recipient uuid, p_actor uuid) returns boolean as $$
  select p_recipient is not null and p_actor is not null and p_recipient <> p_actor
    and not blocked_between(p_recipient, p_actor)
    and exists (select 1 from accounts a where a.id = p_recipient and a.is_active and a.social_banned_at is null)
    and not account_is_minor(p_recipient);
$$ language sql stable security definer set search_path = public;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references accounts(id) on delete cascade,
  actor_id uuid not null references accounts(id) on delete cascade,
  type text not null check (type in ('friend_request', 'friend_accepted', 'post_reaction', 'post_comment', 'group_invite')),
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references post_comments(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_id <> actor_id)
);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);
create index notifications_unread_idx on notifications (recipient_id) where read_at is null;
create index notifications_actor_idx on notifications (actor_id);
create index notifications_post_idx on notifications (post_id);
create index notifications_comment_idx on notifications (comment_id);
create index notifications_group_idx on notifications (group_id);
create index notifications_created_idx on notifications (created_at);
create unique index notifications_reaction_idx on notifications (recipient_id, actor_id, post_id) where type = 'post_reaction';

create function notify_friendship() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' and notify_allowed(new.addressee_id, new.requester_id) then
      insert into notifications (recipient_id, actor_id, type) values (new.addressee_id, new.requester_id, 'friend_request');
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'pending' and new.status = 'accepted' then
      delete from notifications where type = 'friend_request' and recipient_id = new.addressee_id and actor_id = new.requester_id;
      if notify_allowed(new.requester_id, new.addressee_id) then
        insert into notifications (recipient_id, actor_id, type) values (new.requester_id, new.addressee_id, 'friend_accepted');
      end if;
    end if;
  else
    delete from notifications where type = 'friend_request' and recipient_id = old.addressee_id and actor_id = old.requester_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create function notify_reaction() returns trigger as $$
declare
  v_owner uuid;
begin
  if tg_op = 'INSERT' then
    select account_id into v_owner from posts where id = new.post_id;
    if notify_allowed(v_owner, new.account_id) then
      insert into notifications (recipient_id, actor_id, type, post_id)
      values (v_owner, new.account_id, 'post_reaction', new.post_id)
      on conflict do nothing;
    end if;
  else
    delete from notifications where type = 'post_reaction' and actor_id = old.account_id and post_id = old.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create function notify_comment() returns trigger as $$
declare
  v_owner uuid;
begin
  select account_id into v_owner from posts where id = new.post_id;
  if notify_allowed(v_owner, new.account_id) then
    insert into notifications (recipient_id, actor_id, type, post_id, comment_id)
    values (v_owner, new.account_id, 'post_comment', new.post_id, new.id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create function notify_group_invite() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'invited' and notify_allowed(new.account_id, new.invited_by) then
      insert into notifications (recipient_id, actor_id, type, group_id) values (new.account_id, new.invited_by, 'group_invite', new.group_id);
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'invited' and new.status <> 'invited' then
      delete from notifications where type = 'group_invite' and recipient_id = new.account_id and group_id = new.group_id;
    end if;
  else
    delete from notifications where type = 'group_invite' and recipient_id = old.account_id and group_id = old.group_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create function notify_block() returns trigger as $$
begin
  delete from notifications
  where (recipient_id = new.blocker_id and actor_id = new.blocked_id)
     or (recipient_id = new.blocked_id and actor_id = new.blocker_id);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger friendships_notify after insert or update of status or delete on friendships
  for each row execute function notify_friendship();
create trigger post_reactions_notify after insert or delete on post_reactions
  for each row execute function notify_reaction();
create trigger post_comments_notify after insert on post_comments
  for each row execute function notify_comment();
create trigger group_members_notify after insert or update of status or delete on group_members
  for each row execute function notify_group_invite();
create trigger blocks_notify after insert on blocks
  for each row execute function notify_block();

create table stories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  path text not null unique check (char_length(path) <= 200),
  width int not null check (width between 1 and 1600),
  height int not null check (height between 1 and 1600),
  bytes int not null check (bytes between 1 and 5242880),
  caption text check (char_length(caption) between 1 and 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index stories_account_idx on stories (account_id, expires_at desc);
create index stories_expires_idx on stories (expires_at);

create table story_views (
  story_id uuid not null references stories(id) on delete cascade,
  viewer_id uuid not null references accounts(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index story_views_viewer_idx on story_views (viewer_id);

create function can_see_story(p_story uuid) returns boolean as $$
  select exists (
    select 1 from stories s
    where s.id = p_story
      and s.expires_at > now()
      and current_account_id() is not null
      and social_allowed()
      and (s.account_id = current_account_id() or is_friend_of(s.account_id))
  );
$$ language sql stable security definer set search_path = public;

create function owns_story(p_story uuid) returns boolean as $$
  select exists (select 1 from stories s where s.id = p_story and s.account_id = current_account_id());
$$ language sql stable security definer set search_path = public;

create table dm_threads (
  id uuid primary key default gen_random_uuid(),
  account_a uuid not null references accounts(id) on delete cascade,
  account_b uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (account_a < account_b),
  unique (account_a, account_b)
);

create index dm_threads_b_idx on dm_threads (account_b);
create index dm_threads_last_idx on dm_threads (last_message_at desc);

create table dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dm_threads(id) on delete cascade,
  sender_id uuid not null references accounts(id) on delete cascade,
  client_id uuid,
  body text check (char_length(body) between 1 and 2000),
  photo_path text check (char_length(photo_path) <= 200),
  photo_width int check (photo_width between 1 and 1600),
  photo_height int check (photo_height between 1 and 1600),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz,
  check (deleted_at is not null or body is not null or photo_path is not null),
  check ((photo_path is null) = (photo_width is null) and (photo_path is null) = (photo_height is null))
);

create index dm_messages_thread_idx on dm_messages (thread_id, created_at desc);
create index dm_messages_sender_idx on dm_messages (sender_id);
create index dm_messages_created_idx on dm_messages (created_at);
create unique index dm_messages_client_idx on dm_messages (sender_id, client_id) where client_id is not null;

create function is_dm_participant(p_thread uuid) returns boolean as $$
  select exists (
    select 1 from dm_threads t where t.id = p_thread and current_account_id() in (t.account_a, t.account_b)
  );
$$ language sql stable security definer set search_path = public;

alter table reports drop constraint reports_target_type_check;
alter table reports add constraint reports_target_type_check check (target_type in ('post', 'comment', 'account', 'group', 'event', 'message'));

alter table notifications enable row level security;
alter table stories enable row level security;
alter table story_views enable row level security;
alter table dm_threads enable row level security;
alter table dm_messages enable row level security;

revoke all on notifications, stories, story_views, dm_threads, dm_messages from anon, authenticated;
grant select on notifications, stories, story_views, dm_threads, dm_messages to authenticated;

create policy notifications_own on notifications for select to authenticated
  using (recipient_id = (select current_account_id()) and (select social_allowed()));
create policy stories_visible on stories for select to authenticated
  using (expires_at > now() and (select social_allowed()) and (account_id = (select current_account_id()) or is_friend_of(account_id)));
create policy story_views_author on story_views for select to authenticated
  using ((select social_allowed()) and owns_story(story_id));
create policy dm_threads_party on dm_threads for select to authenticated
  using ((select social_allowed()) and (account_a = (select current_account_id()) or account_b = (select current_account_id())));
create policy dm_messages_party on dm_messages for select to authenticated
  using ((select social_allowed()) and is_dm_participant(thread_id));

create function unread_notification_count() returns int as $$
  select count(*)::int from notifications n
  where n.recipient_id = current_account_id() and n.read_at is null and social_allowed();
$$ language sql stable security definer set search_path = public;

create function mark_notifications_read(p_before timestamptz default null) returns int as $$
declare
  n int;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update notifications set read_at = now()
  where recipient_id = current_account_id() and read_at is null and created_at <= coalesce(p_before, now());
  get diagnostics n = row_count;
  return n;
end;
$$ language plpgsql security definer set search_path = public;

create function create_story(p_path text, p_width int, p_height int, p_bytes int, p_caption text default null) returns uuid as $$
declare
  me uuid := current_account_id();
  v_id uuid;
begin
  if me is null or not social_allowed() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_path is null or left(p_path, char_length(me::text) + 3) <> me::text || '/s/' then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if (select count(*) from stories where account_id = me and expires_at > now()) >= 10 then
    raise exception using errcode = 'ST001', message = 'Maksimal 10 cerita aktif';
  end if;
  insert into stories (account_id, path, width, height, bytes, caption)
  values (me, p_path, p_width, p_height, p_bytes, nullif(btrim(coalesce(p_caption, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function delete_story(p_story uuid) returns text as $$
declare
  v_path text;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  delete from stories where id = p_story and account_id = current_account_id() returning path into v_path;
  if v_path is null then
    raise exception using errcode = 'ST002', message = 'Cerita tidak ditemukan';
  end if;
  return v_path;
end;
$$ language plpgsql security definer set search_path = public;

create function mark_story_viewed(p_story uuid) returns void as $$
begin
  if not can_see_story(p_story) then
    raise exception using errcode = 'ST002', message = 'Cerita tidak ditemukan';
  end if;
  insert into story_views (story_id, viewer_id)
  select s.id, current_account_id() from stories s where s.id = p_story and s.account_id <> current_account_id()
  on conflict do nothing;
end;
$$ language plpgsql security definer set search_path = public;

create function story_tray()
returns table(story_id uuid, account_id uuid, path text, width int, height int, caption text, created_at timestamptz, expires_at timestamptz, seen boolean)
as $$
  select s.id, s.account_id, s.path, s.width, s.height, s.caption, s.created_at, s.expires_at,
    (s.account_id = current_account_id()
      or exists (select 1 from story_views v where v.story_id = s.id and v.viewer_id = current_account_id()))
  from stories s
  where social_allowed()
    and s.expires_at > now()
    and (s.account_id = current_account_id() or is_friend_of(s.account_id))
  order by s.created_at desc
  limit 500;
$$ language sql stable security definer set search_path = public;

create function send_message(
  p_to uuid,
  p_body text,
  p_client_id uuid,
  p_photo_path text default null,
  p_photo_width int default null,
  p_photo_height int default null
) returns table(id uuid, thread_id uuid, created_at timestamptz) as $$
declare
  me uuid := current_account_id();
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_a uuid;
  v_b uuid;
  v_thread uuid;
  v_msg dm_messages%rowtype;
begin
  if me is null or not social_allowed() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_to is null or p_to = me or not is_friend_of(p_to) then
    raise exception using errcode = 'DM001', message = 'Anda hanya bisa mengirim pesan ke teman';
  end if;
  if exists (select 1 from accounts a where a.id = p_to and (not a.is_active or a.social_banned_at is not null)) or account_is_minor(p_to) then
    raise exception using errcode = 'DM001', message = 'Anda hanya bisa mengirim pesan ke teman';
  end if;
  if v_body is null and p_photo_path is null then
    raise exception using errcode = 'DM003', message = 'Tulis pesan atau pilih foto';
  end if;
  if v_body is not null and char_length(v_body) > 2000 then
    raise exception using errcode = 'DM003', message = 'Pesan maksimal 2.000 karakter';
  end if;
  if p_photo_path is not null and left(p_photo_path, char_length(me::text) + 4) <> me::text || '/dm/' then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_client_id is not null then
    select * into v_msg from dm_messages m where m.sender_id = me and m.client_id = p_client_id;
    if v_msg.id is not null then
      return query select v_msg.id, v_msg.thread_id, v_msg.created_at;
      return;
    end if;
  end if;
  if (select count(*) from dm_messages m where m.sender_id = me and m.created_at > now() - interval '1 day') >= 1000 then
    raise exception using errcode = 'DM002', message = 'Batas 1.000 pesan per hari tercapai';
  end if;
  v_a := least(me, p_to);
  v_b := greatest(me, p_to);
  insert into dm_threads (account_a, account_b) values (v_a, v_b) on conflict (account_a, account_b) do nothing;
  select t.id into v_thread from dm_threads t where t.account_a = v_a and t.account_b = v_b;
  insert into dm_messages (thread_id, sender_id, client_id, body, photo_path, photo_width, photo_height)
  values (v_thread, me, p_client_id, v_body, p_photo_path, p_photo_width, p_photo_height)
  returning * into v_msg;
  update dm_threads t set last_message_at = v_msg.created_at where t.id = v_thread;
  return query select v_msg.id, v_msg.thread_id, v_msg.created_at;
end;
$$ language plpgsql security definer set search_path = public;

create function mark_thread_read(p_thread uuid) returns int as $$
declare
  n int;
begin
  if current_account_id() is null or not social_allowed() or not is_dm_participant(p_thread) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update dm_messages set read_at = now()
  where thread_id = p_thread and sender_id <> current_account_id() and read_at is null and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$ language plpgsql security definer set search_path = public;

create function unsend_message(p_message uuid) returns text as $$
declare
  v_path text;
  v_found uuid;
begin
  if current_account_id() is null or not social_allowed() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  select m.id, m.photo_path into v_found, v_path
  from dm_messages m where m.id = p_message and m.sender_id = current_account_id() and m.deleted_at is null
  for update;
  if v_found is null then
    raise exception using errcode = 'DM004', message = 'Pesan tidak ditemukan';
  end if;
  update dm_messages set deleted_at = now(), body = null, photo_path = null, photo_width = null, photo_height = null where id = v_found;
  return v_path;
end;
$$ language plpgsql security definer set search_path = public;

create function dm_inbox()
returns table(
  thread_id uuid, other_id uuid, other_username text, other_full_name text, other_avatar_path text,
  last_message_at timestamptz, last_body text, last_has_photo boolean, last_deleted boolean, last_sender_id uuid, unread_count int
) as $$
  select t.id, o.id, o.username, o.full_name, o.avatar_path,
    t.last_message_at, m.body, m.photo_path is not null, m.deleted_at is not null, m.sender_id,
    (select count(*) from dm_messages x
      where x.thread_id = t.id and x.sender_id <> current_account_id() and x.read_at is null and x.deleted_at is null)::int
  from dm_threads t
  join accounts o on o.id = case when t.account_a = current_account_id() then t.account_b else t.account_a end
  join lateral (select * from dm_messages x where x.thread_id = t.id order by x.created_at desc limit 1) m on true
  where social_allowed()
    and current_account_id() in (t.account_a, t.account_b)
    and is_friend_of(o.id)
    and o.is_active and o.social_banned_at is null
  order by t.last_message_at desc
  limit 200;
$$ language sql stable security definer set search_path = public;

create function dm_open(p_username text)
returns table(other_id uuid, other_username text, other_full_name text, other_avatar_path text, thread_id uuid, can_send boolean)
as $$
  select o.id, o.username, o.full_name, o.avatar_path, t.id,
    (is_friend_of(o.id) and o.social_banned_at is null and not account_is_minor(o.id))
  from accounts o
  left join dm_threads t
    on t.account_a = least(current_account_id(), o.id) and t.account_b = greatest(current_account_id(), o.id)
  where social_allowed()
    and o.username = lower(btrim(p_username))
    and o.id <> current_account_id()
    and o.is_active
    and (is_friend_of(o.id) or t.id is not null)
  limit 1;
$$ language sql stable security definer set search_path = public;

create function unread_message_count() returns int as $$
  select count(distinct t.id)::int
  from dm_threads t
  join dm_messages m on m.thread_id = t.id
  where social_allowed()
    and current_account_id() in (t.account_a, t.account_b)
    and m.sender_id <> current_account_id() and m.read_at is null and m.deleted_at is null
    and is_friend_of(case when t.account_a = current_account_id() then t.account_b else t.account_a end);
$$ language sql stable security definer set search_path = public;

create function expired_social_files(p_now timestamptz) returns setof text as $$
  select s.path from stories s where s.expires_at <= p_now
  union
  select m.photo_path from dm_messages m where m.created_at < p_now - interval '365 days' and m.photo_path is not null;
$$ language sql stable security definer set search_path = public;

create function purge_social_expired(p_now timestamptz) returns table(stories_removed int, messages_removed int, notifications_removed int) as $$
declare
  s int;
  m int;
  n int;
begin
  perform set_config('ruzz.purge', 'on', true);
  delete from stories where expires_at <= p_now;
  get diagnostics s = row_count;
  delete from dm_messages where created_at < p_now - interval '365 days';
  get diagnostics m = row_count;
  delete from dm_threads t where t.last_message_at < p_now - interval '365 days'
    and not exists (select 1 from dm_messages x where x.thread_id = t.id);
  delete from notifications where created_at < p_now - interval '90 days';
  get diagnostics n = row_count;
  return query select s, m, n;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function social_allowed(), blocked_between(uuid, uuid), notify_allowed(uuid, uuid), is_dm_participant(uuid),
  can_see_story(uuid), owns_story(uuid) from public, anon;
grant execute on function social_allowed(), is_dm_participant(uuid), can_see_story(uuid), owns_story(uuid) to authenticated;
revoke execute on function blocked_between(uuid, uuid), notify_allowed(uuid, uuid) from authenticated;

revoke execute on function notify_friendship(), notify_reaction(), notify_comment(), notify_group_invite(), notify_block()
  from public, anon, authenticated;

revoke execute on function unread_notification_count(), mark_notifications_read(timestamptz),
  create_story(text, int, int, int, text), delete_story(uuid), mark_story_viewed(uuid), story_tray(),
  send_message(uuid, text, uuid, text, int, int), mark_thread_read(uuid), unsend_message(uuid),
  dm_inbox(), dm_open(text), unread_message_count() from public, anon;
grant execute on function unread_notification_count(), mark_notifications_read(timestamptz),
  create_story(text, int, int, int, text), delete_story(uuid), mark_story_viewed(uuid), story_tray(),
  send_message(uuid, text, uuid, text, int, int), mark_thread_read(uuid), unsend_message(uuid),
  dm_inbox(), dm_open(text), unread_message_count() to authenticated;

revoke execute on function expired_social_files(timestamptz), purge_social_expired(timestamptz) from public, anon, authenticated;
