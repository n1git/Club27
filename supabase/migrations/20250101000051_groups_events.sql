create table groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create index groups_owner_idx on groups (owner_id);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid references accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, account_id)
);

create index group_members_account_idx on group_members (account_id, status);
create index group_members_invited_by_idx on group_members (invited_by);

create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  created_by uuid not null references accounts(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text check (char_length(description) <= 1000),
  location text check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity int check (capacity between 1 and 1000),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index events_group_idx on events (group_id, starts_at);
create index events_created_by_idx on events (created_by);

create table event_rsvps (
  event_id uuid not null references events(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'declined')),
  updated_at timestamptz not null default now(),
  primary key (event_id, account_id)
);

create index event_rsvps_account_idx on event_rsvps (account_id);

create function is_group_member(p_group uuid) returns boolean as $$
  select exists (
    select 1 from group_members
    where group_id = p_group and account_id = current_account_id() and status = 'active'
  );
$$ language sql stable security definer set search_path = public;

create function is_group_invitee(p_group uuid) returns boolean as $$
  select exists (
    select 1 from group_members
    where group_id = p_group and account_id = current_account_id() and status = 'invited'
  );
$$ language sql stable security definer set search_path = public;

create function is_group_owner(p_group uuid) returns boolean as $$
  select exists (
    select 1 from groups where id = p_group and owner_id = current_account_id()
  );
$$ language sql stable security definer set search_path = public;

create function can_see_event(p_event uuid) returns boolean as $$
  select exists (
    select 1 from events e where e.id = p_event and is_group_member(e.group_id)
  );
$$ language sql stable security definer set search_path = public;

create function is_group_peer(p_other uuid) returns boolean as $$
  select current_account_id() is not null
    and exists (
      select 1 from group_members a join group_members b on b.group_id = a.group_id
      where a.account_id = current_account_id() and b.account_id = p_other
        and (a.status = 'active' or b.status = 'active')
    )
    and not is_blocked_pair(p_other);
$$ language sql stable security definer set search_path = public;

create or replace view social_people as
  select a.id, a.username, a.full_name
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

alter table reports drop constraint reports_target_type_check;
alter table reports add constraint reports_target_type_check check (target_type in ('post', 'comment', 'account', 'group', 'event'));

create function create_group(p_name text, p_description text default null) returns uuid as $$
declare
  me uuid := current_account_id();
  v_id uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if (select count(*) from groups where owner_id = me) >= 20 then
    raise exception using errcode = 'GR001', message = 'Batas 20 grup yang Anda buat tercapai';
  end if;
  insert into groups (owner_id, name, description)
  values (me, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''))
  returning id into v_id;
  insert into group_members (group_id, account_id, role, status) values (v_id, me, 'owner', 'active');
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function invite_to_group(p_group uuid, p_account uuid) returns void as $$
begin
  if current_account_id() is null or not is_group_owner(p_group) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not is_friend_of(p_account) then
    raise exception using errcode = 'GR002', message = 'Hanya teman yang bisa diundang ke grup';
  end if;
  if exists (select 1 from group_members where group_id = p_group and account_id = p_account) then
    raise exception using errcode = 'GR003', message = 'Teman ini sudah di grup atau sudah diundang';
  end if;
  if (select count(*) from group_members where group_id = p_group) >= 200 then
    raise exception using errcode = 'GR001', message = 'Grup sudah penuh (200 anggota dan undangan)';
  end if;
  insert into group_members (group_id, account_id, role, status, invited_by)
  values (p_group, p_account, 'member', 'invited', current_account_id());
end;
$$ language plpgsql security definer set search_path = public;

create function respond_group_invite(p_group uuid, p_accept boolean) returns void as $$
declare
  n int;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_accept then
    if (select count(*) from group_members where account_id = current_account_id() and status = 'active') >= 50 then
      raise exception using errcode = 'GR001', message = 'Batas 50 grup yang Anda ikuti tercapai';
    end if;
    update group_members set status = 'active'
    where group_id = p_group and account_id = current_account_id() and status = 'invited';
  else
    delete from group_members where group_id = p_group and account_id = current_account_id() and status = 'invited';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using errcode = 'GR004', message = 'Undangan tidak ditemukan';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create function leave_group(p_group uuid) returns void as $$
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if is_group_owner(p_group) then
    raise exception using errcode = 'GR005', message = 'Pemilik tidak bisa keluar. Hapus grup jika tidak dipakai lagi.';
  end if;
  delete from group_members where group_id = p_group and account_id = current_account_id();
  delete from event_rsvps where account_id = current_account_id()
    and event_id in (select id from events where group_id = p_group);
end;
$$ language plpgsql security definer set search_path = public;

create function remove_group_member(p_group uuid, p_account uuid) returns void as $$
begin
  if current_account_id() is null or not is_group_owner(p_group) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_account = current_account_id() then
    raise exception using errcode = 'GR005', message = 'Pemilik tidak bisa dikeluarkan';
  end if;
  delete from group_members where group_id = p_group and account_id = p_account;
  delete from event_rsvps where account_id = p_account
    and event_id in (select id from events where group_id = p_group);
end;
$$ language plpgsql security definer set search_path = public;

create function delete_group(p_group uuid) returns void as $$
begin
  if current_account_id() is null or not is_group_owner(p_group) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  delete from groups where id = p_group;
end;
$$ language plpgsql security definer set search_path = public;

create function create_event(
  p_group uuid,
  p_title text,
  p_description text,
  p_location text,
  p_starts timestamptz,
  p_ends timestamptz,
  p_capacity int
) returns uuid as $$
declare
  v_id uuid;
begin
  if current_account_id() is null or not is_group_member(p_group) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_starts <= now() then
    raise exception using errcode = 'EV001', message = 'Waktu mulai harus di masa depan';
  end if;
  if (select count(*) from events where group_id = p_group and cancelled_at is null and starts_at > now()) >= 30 then
    raise exception using errcode = 'EV001', message = 'Batas 30 event mendatang per grup tercapai';
  end if;
  insert into events (group_id, created_by, title, description, location, starts_at, ends_at, capacity)
  values (
    p_group, current_account_id(), btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''), p_starts, p_ends, p_capacity
  )
  returning id into v_id;
  insert into event_rsvps (event_id, account_id, status) values (v_id, current_account_id(), 'going');
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function cancel_event(p_event uuid) returns void as $$
declare
  e events%rowtype;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  select * into e from events where id = p_event for update;
  if e.id is null or not is_group_member(e.group_id) or (e.created_by <> current_account_id() and not is_group_owner(e.group_id)) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update events set cancelled_at = coalesce(cancelled_at, now()) where id = e.id;
end;
$$ language plpgsql security definer set search_path = public;

create function rsvp_event(p_event uuid, p_status text) returns void as $$
declare
  e events%rowtype;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_status not in ('going', 'maybe', 'declined') then
    raise exception using errcode = 'EV002', message = 'Status tidak valid';
  end if;
  select * into e from events where id = p_event for update;
  if e.id is null or not is_group_member(e.group_id) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if e.cancelled_at is not null or coalesce(e.ends_at, e.starts_at) <= now() then
    raise exception using errcode = 'EV003', message = 'Event sudah dibatalkan atau selesai';
  end if;
  if p_status = 'going' and e.capacity is not null and (
    select count(*) from event_rsvps where event_id = e.id and status = 'going' and account_id <> current_account_id()
  ) >= e.capacity then
    raise exception using errcode = 'EV004', message = 'Kuota event sudah penuh';
  end if;
  insert into event_rsvps (event_id, account_id, status) values (e.id, current_account_id(), p_status)
  on conflict (event_id, account_id) do update set status = excluded.status, updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

alter table groups enable row level security;
alter table group_members enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;

revoke all on groups, group_members, events, event_rsvps from anon, authenticated;
grant select on groups, group_members, events, event_rsvps to authenticated;

create policy groups_select on groups for select to authenticated
  using (is_group_member(id) or is_group_invitee(id));
create policy group_members_select on group_members for select to authenticated
  using (is_group_member(group_id) or account_id = (select current_account_id()));
create policy events_select on events for select to authenticated using (is_group_member(group_id));
create policy event_rsvps_select on event_rsvps for select to authenticated using (can_see_event(event_id));

revoke execute on function is_group_member(uuid), is_group_invitee(uuid), is_group_owner(uuid), can_see_event(uuid),
  is_group_peer(uuid) from public, anon;
grant execute on function is_group_member(uuid), is_group_invitee(uuid), is_group_owner(uuid), can_see_event(uuid),
  is_group_peer(uuid) to authenticated;

revoke execute on function create_group(text, text), invite_to_group(uuid, uuid), respond_group_invite(uuid, boolean),
  leave_group(uuid), remove_group_member(uuid, uuid), delete_group(uuid),
  create_event(uuid, text, text, text, timestamptz, timestamptz, int), cancel_event(uuid), rsvp_event(uuid, text)
  from public, anon;
grant execute on function create_group(text, text), invite_to_group(uuid, uuid), respond_group_invite(uuid, boolean),
  leave_group(uuid), remove_group_member(uuid, uuid), delete_group(uuid),
  create_event(uuid, text, text, text, timestamptz, timestamptz, int), cancel_event(uuid), rsvp_event(uuid, text)
  to authenticated;
