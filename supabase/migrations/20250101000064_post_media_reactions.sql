alter table posts add column hidden_at timestamptz;

create or replace function can_see_post(p_post uuid) returns boolean as $$
  select exists (
    select 1 from posts p
    where p.id = p_post
      and current_account_id() is not null
      and (p.account_id = current_account_id() or (p.hidden_at is null and is_friend_of(p.account_id)))
  );
$$ language sql stable security definer set search_path = public;

drop policy posts_visible on posts;
create policy posts_visible on posts for select to authenticated
  using (account_id = (select current_account_id()) or (hidden_at is null and is_friend_of(account_id)));

create function sync_post_hidden() returns trigger as $$
declare
  v_open int;
  v_upheld int;
begin
  if new.target_type <> 'post' then
    return new;
  end if;
  select count(*) filter (where status = 'open'), count(*) filter (where status in ('removed', 'suspended'))
    into v_open, v_upheld
  from reports where target_type = 'post' and target_id = new.target_id;
  update posts set hidden_at = case
      when v_open >= 3 then coalesce(hidden_at, now())
      when v_open = 0 and v_upheld = 0 then null
      else hidden_at
    end
  where id = new.target_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function sync_post_hidden() from public, anon, authenticated;

create trigger reports_sync_post_hidden after insert or update of status on reports
  for each row execute function sync_post_hidden();

alter table post_reactions add column kind text not null default 'kudos' check (kind in ('kudos', 'fire', 'strong', 'clap'));
grant update (kind) on post_reactions to authenticated;
create policy reactions_update on post_reactions for update to authenticated
  using (account_id = (select current_account_id()) and can_see_post(post_id))
  with check (account_id = (select current_account_id()) and can_see_post(post_id));

drop function kudos_for_posts(uuid[]);
create function kudos_for_posts(p_posts uuid[])
returns table(post_id uuid, account_id uuid, username text, full_name text, is_me boolean, kind text)
as $$
  select r.post_id, r.account_id,
    case when r.account_id = current_account_id() or is_related(r.account_id) or is_group_peer(r.account_id) then a.username end,
    case when r.account_id = current_account_id() or is_related(r.account_id) or is_group_peer(r.account_id) then a.full_name end,
    r.account_id = current_account_id(),
    r.kind
  from post_reactions r
  join accounts a on a.id = r.account_id
  where cardinality(p_posts) <= 100
    and r.post_id = any (p_posts)
    and can_see_post(r.post_id)
    and a.is_active and a.social_banned_at is null
    and (r.account_id = current_account_id() or not is_blocked_pair(r.account_id))
  order by r.created_at;
$$ language sql stable security definer set search_path = public;

revoke execute on function kudos_for_posts(uuid[]) from public, anon;
grant execute on function kudos_for_posts(uuid[]) to authenticated;

create table post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  path text not null unique check (char_length(path) <= 200),
  position smallint not null check (position between 0 and 3),
  width int not null check (width between 1 and 1600),
  height int not null check (height between 1 and 1600),
  bytes int not null check (bytes between 1 and 5242880),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create index post_media_account_idx on post_media (account_id);

alter table post_media enable row level security;
revoke all on post_media from anon, authenticated;
grant select on post_media to authenticated;
create policy post_media_visible on post_media for select to authenticated
  using (can_see_post(post_id));

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets
      set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/webp']
      where id = 'post-media'$q$;
  end if;
end $$;
