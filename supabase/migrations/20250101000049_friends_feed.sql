create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references accounts(id) on delete cascade,
  addressee_id uuid not null references accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create unique index friendships_pair_idx on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on friendships (addressee_id, status);
create index friendships_requester_idx on friendships (requester_id, status);

create table blocks (
  blocker_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  blocked_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on blocks (blocked_id);

create table posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  kind text not null check (kind in ('text', 'workout')),
  body text check (char_length(body) between 1 and 2000),
  sport text references club_types(code),
  performed_on date,
  duration_min int check (duration_min between 1 and 1440),
  distance_m int check (distance_m between 1 and 1000000),
  visibility text not null default 'friends' check (visibility = 'friends'),
  created_at timestamptz not null default now(),
  check (
    (kind = 'text' and body is not null and sport is null and performed_on is null and duration_min is null and distance_m is null)
    or (kind = 'workout' and sport is not null and performed_on is not null and duration_min is not null)
  )
);

create index posts_account_idx on posts (account_id, created_at desc);
create index posts_created_idx on posts (created_at desc);

create table post_reactions (
  post_id uuid not null references posts(id) on delete cascade,
  account_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, account_id)
);

create index post_reactions_account_idx on post_reactions (account_id);

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  account_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index post_comments_post_idx on post_comments (post_id, created_at);
create index post_comments_account_idx on post_comments (account_id, created_at desc);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'account')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create function is_blocked_pair(p_other uuid) returns boolean as $$
  select exists (
    select 1 from blocks b
    where (b.blocker_id = current_account_id() and b.blocked_id = p_other)
       or (b.blocked_id = current_account_id() and b.blocker_id = p_other)
  );
$$ language sql stable security definer set search_path = public;

create function is_friend_of(p_other uuid) returns boolean as $$
  select current_account_id() is not null
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = current_account_id() and f.addressee_id = p_other)
          or (f.requester_id = p_other and f.addressee_id = current_account_id()))
    )
    and not is_blocked_pair(p_other);
$$ language sql stable security definer set search_path = public;

create function is_related(p_other uuid) returns boolean as $$
  select current_account_id() is not null
    and (
      exists (
        select 1 from friendships f
        where (f.requester_id = current_account_id() and f.addressee_id = p_other)
           or (f.requester_id = p_other and f.addressee_id = current_account_id())
      )
      or exists (select 1 from blocks b where b.blocker_id = current_account_id() and b.blocked_id = p_other)
    );
$$ language sql stable security definer set search_path = public;

create function can_see_post(p_post uuid) returns boolean as $$
  select exists (
    select 1 from posts p
    where p.id = p_post
      and current_account_id() is not null
      and (p.account_id = current_account_id() or is_friend_of(p.account_id))
  );
$$ language sql stable security definer set search_path = public;

create view social_people as
  select a.id, a.username, a.full_name
  from accounts a
  where a.is_active
    and (
      a.id = current_account_id()
      or is_related(a.id)
      or exists (
        select 1 from post_comments c join posts p on p.id = c.post_id
        where c.account_id = a.id
          and not is_blocked_pair(a.id)
          and (p.account_id = current_account_id() or is_friend_of(p.account_id))
      )
    );

create function request_friend(p_username text) returns text as $$
declare
  me uuid := current_account_id();
  v_other uuid;
  f friendships%rowtype;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  select id into v_other from accounts where username = lower(btrim(p_username)) and is_active;
  if v_other is null or is_blocked_pair(v_other) then
    raise exception using errcode = 'FR001', message = 'Pengguna tidak ditemukan';
  end if;
  if v_other = me then
    raise exception using errcode = 'FR002', message = 'Anda tidak bisa berteman dengan diri sendiri';
  end if;
  select * into f from friendships
  where (requester_id = me and addressee_id = v_other) or (requester_id = v_other and addressee_id = me);
  if f.id is not null then
    if f.status = 'accepted' then
      raise exception using errcode = 'FR003', message = 'Kalian sudah berteman';
    end if;
    if f.requester_id = v_other then
      update friendships set status = 'accepted', responded_at = now() where id = f.id;
      return 'accepted';
    end if;
    raise exception using errcode = 'FR003', message = 'Permintaan pertemanan sudah dikirim';
  end if;
  if (select count(*) from friendships where requester_id = me and status = 'pending') >= 100
     or (select count(*) from friendships where (requester_id = me or addressee_id = me)) >= 1000 then
    raise exception using errcode = 'FR004', message = 'Batas permintaan atau jumlah teman tercapai';
  end if;
  insert into friendships (requester_id, addressee_id) values (me, v_other);
  return 'requested';
end;
$$ language plpgsql security definer set search_path = public;

create function respond_friend(p_id uuid, p_accept boolean) returns void as $$
declare
  me uuid := current_account_id();
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_accept then
    update friendships set status = 'accepted', responded_at = now()
    where id = p_id and addressee_id = me and status = 'pending' and not is_blocked_pair(requester_id);
  else
    delete from friendships where id = p_id and addressee_id = me and status = 'pending';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using errcode = 'FR001', message = 'Permintaan tidak ditemukan';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create function remove_friend(p_other uuid) returns void as $$
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  delete from friendships
  where (requester_id = current_account_id() and addressee_id = p_other)
     or (requester_id = p_other and addressee_id = current_account_id());
end;
$$ language plpgsql security definer set search_path = public;

create function block_account(p_other uuid) returns void as $$
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_other = current_account_id() or not exists (select 1 from accounts where id = p_other) then
    raise exception using errcode = 'FR001', message = 'Pengguna tidak ditemukan';
  end if;
  insert into blocks (blocker_id, blocked_id) values (current_account_id(), p_other) on conflict do nothing;
  delete from friendships
  where (requester_id = current_account_id() and addressee_id = p_other)
     or (requester_id = p_other and addressee_id = current_account_id());
end;
$$ language plpgsql security definer set search_path = public;

create function unblock_account(p_other uuid) returns void as $$
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  delete from blocks where blocker_id = current_account_id() and blocked_id = p_other;
end;
$$ language plpgsql security definer set search_path = public;

create function create_post(p_body text) returns uuid as $$
declare
  v_id uuid;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  insert into posts (account_id, kind, body) values (current_account_id(), 'text', btrim(p_body)) returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function share_workout(p_log uuid, p_body text default null) returns uuid as $$
declare
  w workout_logs%rowtype;
  v_id uuid;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  select * into w from workout_logs where id = p_log and account_id = current_account_id();
  if w.id is null then
    raise exception using errcode = 'PO001', message = 'Catatan latihan tidak ditemukan';
  end if;
  insert into posts (account_id, kind, body, sport, performed_on, duration_min, distance_m)
  values (current_account_id(), 'workout', nullif(btrim(coalesce(p_body, '')), ''), w.sport, w.performed_on, w.duration_min, w.distance_m)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function enforce_social_limits() returns trigger as $$
begin
  if tg_table_name = 'posts' then
    if (select count(*) from posts where account_id = new.account_id and created_at > now() - interval '1 day') >= 50 then
      raise exception using errcode = 'PO002', message = 'Batas 50 postingan per hari tercapai';
    end if;
  elsif tg_table_name = 'post_comments' then
    if (select count(*) from post_comments where account_id = new.account_id and created_at > now() - interval '1 day') >= 200 then
      raise exception using errcode = 'PO002', message = 'Batas 200 komentar per hari tercapai';
    end if;
  else
    if (select count(*) from reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 50 then
      raise exception using errcode = 'PO002', message = 'Batas 50 laporan per hari tercapai';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger posts_limits before insert on posts for each row execute function enforce_social_limits();
create trigger post_comments_limits before insert on post_comments for each row execute function enforce_social_limits();
create trigger reports_limits before insert on reports for each row execute function enforce_social_limits();

alter table friendships enable row level security;
alter table blocks enable row level security;
alter table posts enable row level security;
alter table post_reactions enable row level security;
alter table post_comments enable row level security;
alter table reports enable row level security;

revoke all on friendships, blocks, posts, post_reactions, post_comments, reports from anon, authenticated;
revoke all on social_people from anon, authenticated;
grant select on friendships, blocks, posts, social_people to authenticated;
grant select, insert, delete on post_reactions, post_comments to authenticated;
grant delete on posts to authenticated;
grant insert on reports to authenticated;

create policy friendships_party on friendships for select to authenticated
  using (requester_id = (select current_account_id()) or addressee_id = (select current_account_id()));

create policy blocks_own on blocks for select to authenticated
  using (blocker_id = (select current_account_id()));

create policy posts_visible on posts for select to authenticated
  using (account_id = (select current_account_id()) or is_friend_of(account_id));
create policy posts_delete_own on posts for delete to authenticated
  using (account_id = (select current_account_id()));

create policy reactions_select on post_reactions for select to authenticated using (can_see_post(post_id));
create policy reactions_insert on post_reactions for insert to authenticated
  with check (account_id = (select current_account_id()) and can_see_post(post_id));
create policy reactions_delete on post_reactions for delete to authenticated
  using (account_id = (select current_account_id()));

create policy comments_select on post_comments for select to authenticated
  using (can_see_post(post_id) and not is_blocked_pair(account_id));
create policy comments_insert on post_comments for insert to authenticated
  with check (account_id = (select current_account_id()) and can_see_post(post_id));
create policy comments_delete on post_comments for delete to authenticated
  using (
    account_id = (select current_account_id())
    or exists (select 1 from posts p where p.id = post_id and p.account_id = (select current_account_id()))
  );

create policy reports_insert on reports for insert to authenticated
  with check (reporter_id = (select current_account_id()));

revoke execute on function is_blocked_pair(uuid), is_friend_of(uuid), is_related(uuid), can_see_post(uuid),
  enforce_social_limits() from public, anon;
grant execute on function is_blocked_pair(uuid), is_friend_of(uuid), is_related(uuid), can_see_post(uuid) to authenticated;

revoke execute on function request_friend(text), respond_friend(uuid, boolean), remove_friend(uuid), block_account(uuid),
  unblock_account(uuid), create_post(text), share_workout(uuid, text) from public, anon;
grant execute on function request_friend(text), respond_friend(uuid, boolean), remove_friend(uuid), block_account(uuid),
  unblock_account(uuid), create_post(text), share_workout(uuid, text) to authenticated;
