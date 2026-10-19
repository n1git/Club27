create table club_leaderboard_optins (
  account_id uuid not null references accounts(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, club_id)
);

create index club_leaderboard_optins_club_idx on club_leaderboard_optins (club_id);

alter table club_leaderboard_optins enable row level security;
revoke all on club_leaderboard_optins from anon, authenticated;

create trigger a00_org_writable before insert or update on club_leaderboard_optins
  for each row execute function enforce_org_writable();

create function drop_leaderboard_optin() returns trigger as $$
begin
  delete from club_leaderboard_optins o
  using club_profiles p
  where p.id = old.profile_id and o.account_id = p.account_id and o.club_id = old.club_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function drop_leaderboard_optin() from public, anon, authenticated;

create trigger club_members_drop_optin after update on club_members
  for each row when (old.profile_id is not null and ((old.is_active and not new.is_active) or old.profile_id is distinct from new.profile_id))
  execute function drop_leaderboard_optin();

create trigger club_members_drop_optin_delete after delete on club_members
  for each row when (old.profile_id is not null)
  execute function drop_leaderboard_optin();

create function is_linked_club_member(p_club uuid, p_account uuid) returns boolean as $$
  select exists (
    select 1
    from club_members m
    join club_profiles p on p.id = m.profile_id
    where m.club_id = p_club and m.is_active
      and p.account_id = p_account and p.role = 'member' and p.is_active
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function is_linked_club_member(uuid, uuid) from public, anon, authenticated;

create function leaderboard_since(p_period text) returns date as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if p_period = 'week' then
    return v_today - (extract(isodow from v_today)::int - 1);
  elsif p_period = 'month' then
    return date_trunc('month', v_today)::date;
  end if;
  raise exception using errcode = '22023', message = 'Periode tidak valid';
end;
$$ language plpgsql stable;

revoke execute on function leaderboard_since(text) from public, anon, authenticated;

create function leaderboard_rows(p_accounts uuid[], p_metric text, p_period text, p_sport text)
returns table(rank int, account_id uuid, username text, full_name text, sessions int, distance_m bigint, duration_min bigint, is_me boolean)
as $$
declare
  v_since date;
  v_me uuid := current_account_id();
begin
  if p_metric not in ('distance', 'duration', 'sessions') then
    raise exception using errcode = '22023', message = 'Metrik tidak valid';
  end if;
  v_since := leaderboard_since(p_period);
  return query
  with totals as (
    select a.id as aid, a.username as uname, a.full_name as fname,
      count(w.id)::int as n,
      coalesce(sum(w.distance_m), 0)::bigint as dist,
      coalesce(sum(w.duration_min), 0)::bigint as dur
    from accounts a
    join workout_logs w on w.account_id = a.id
      and w.performed_on >= v_since
      and w.performed_on <= (now() at time zone 'Asia/Jakarta')::date
      and (p_sport is null or w.sport = p_sport)
    where a.id = any (p_accounts)
    group by a.id, a.username, a.full_name
  ), scored as (
    select t.*, case p_metric when 'distance' then t.dist when 'duration' then t.dur else t.n::bigint end as score
    from totals t
  ), ranked as (
    select s.*, rank() over (order by s.score desc) as rk
    from scored s
    where s.score > 0
  )
  select r.rk::int, r.aid, r.uname, r.fname, r.n, r.dist, r.dur, r.aid = v_me
  from ranked r
  where r.rk <= 10 or r.aid = v_me
  order by r.rk, r.uname;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function leaderboard_rows(uuid[], text, text, text) from public, anon, authenticated;

create function group_leaderboard(p_group uuid, p_metric text, p_period text, p_sport text default null)
returns table(rank int, account_id uuid, username text, full_name text, sessions int, distance_m bigint, duration_min bigint, is_me boolean)
as $$
declare
  v_me uuid := current_account_id();
begin
  if v_me is null or exists (select 1 from accounts where id = v_me and social_banned_at is not null) then
    return;
  end if;
  if not exists (select 1 from group_members gm where gm.group_id = p_group and gm.account_id = v_me and gm.status = 'active') then
    return;
  end if;
  return query
  select * from leaderboard_rows(
    (
      select coalesce(array_agg(gm.account_id), '{}'::uuid[])
      from group_members gm
      join accounts a on a.id = gm.account_id
      where gm.group_id = p_group and gm.status = 'active'
        and a.is_active and a.social_banned_at is null
        and (gm.account_id = v_me or not is_blocked_pair(gm.account_id))
    ),
    p_metric, p_period, p_sport
  );
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function group_leaderboard(uuid, text, text, text) from public, anon;
grant execute on function group_leaderboard(uuid, text, text, text) to authenticated;

create function club_leaderboard(p_club uuid, p_metric text, p_period text, p_sport text default null)
returns table(rank int, account_id uuid, username text, full_name text, sessions int, distance_m bigint, duration_min bigint, is_me boolean)
as $$
declare
  v_me uuid := current_account_id();
begin
  if v_me is null or exists (select 1 from accounts where id = v_me and social_banned_at is not null) then
    return;
  end if;
  if not (
    is_linked_club_member(p_club, v_me)
    or exists (
      select 1 from club_profiles p
      where p.club_id = p_club and p.account_id = v_me and p.role <> 'member' and p.is_active
        and 'members.view_all' = any (profile_permissions(p.id))
    )
    or exists (
      select 1 from organization_users ou
      join clubs c on c.organization_id = ou.organization_id
      where c.id = p_club and ou.account_id = v_me and ou.is_active and ou.base_role in ('p_owner', 'owner')
    )
  ) then
    return;
  end if;
  return query
  select * from leaderboard_rows(
    (
      select coalesce(array_agg(o.account_id), '{}'::uuid[])
      from club_leaderboard_optins o
      join accounts a on a.id = o.account_id
      where o.club_id = p_club
        and is_linked_club_member(p_club, o.account_id)
        and a.is_active and a.social_banned_at is null
        and (o.account_id = v_me or not is_blocked_pair(o.account_id))
    ),
    p_metric, p_period, p_sport
  );
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function club_leaderboard(uuid, text, text, text) from public, anon;
grant execute on function club_leaderboard(uuid, text, text, text) to authenticated;

create function set_leaderboard_optin(p_club uuid, p_on boolean) returns void as $$
declare
  v_me uuid := current_account_id();
begin
  if v_me is null or not is_linked_club_member(p_club, v_me) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_on then
    insert into club_leaderboard_optins (account_id, club_id) values (v_me, p_club) on conflict do nothing;
  else
    delete from club_leaderboard_optins where account_id = v_me and club_id = p_club;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function set_leaderboard_optin(uuid, boolean) from public, anon;
grant execute on function set_leaderboard_optin(uuid, boolean) to authenticated;

create function my_leaderboard_clubs() returns table(club_id uuid, club_name text, opted_in boolean) as $$
  select c.id, c.name,
    exists (select 1 from club_leaderboard_optins o where o.account_id = p.account_id and o.club_id = c.id)
  from club_profiles p
  join club_members m on m.profile_id = p.id
  join clubs c on c.id = m.club_id
  where p.account_id = current_account_id() and p.role = 'member' and p.is_active and m.is_active and c.is_active
  order by c.name;
$$ language sql stable security definer set search_path = public;

revoke execute on function my_leaderboard_clubs() from public, anon;
grant execute on function my_leaderboard_clubs() to authenticated;

create function kudos_for_posts(p_posts uuid[])
returns table(post_id uuid, account_id uuid, username text, full_name text, is_me boolean)
as $$
  select r.post_id, r.account_id,
    case when r.account_id = current_account_id() or is_related(r.account_id) or is_group_peer(r.account_id) then a.username end,
    case when r.account_id = current_account_id() or is_related(r.account_id) or is_group_peer(r.account_id) then a.full_name end,
    r.account_id = current_account_id()
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
