alter table club_types add column max_m_per_min numeric(6,1) check (max_m_per_min is null or max_m_per_min > 0);
update club_types set max_m_per_min = 150 where code = 'swimming';

create or replace function enforce_workout_log() returns trigger as $$
declare
  v_max numeric;
begin
  if new.performed_on > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'WL002', message = 'Tanggal latihan tidak boleh di masa depan';
  end if;
  if new.distance_m is not null then
    select max_m_per_min into v_max from club_types where code = new.sport;
    if v_max is not null and new.distance_m::numeric / new.duration_min > v_max then
      raise exception using errcode = 'WL003', message = 'Jarak terlalu jauh untuk durasi ini. Periksa kembali catatan latihan.';
    end if;
  end if;
  if tg_op = 'INSERT' and (select count(*) from workout_logs where account_id = new.account_id) >= 10000 then
    raise exception using errcode = 'WL001', message = 'Batas 10.000 catatan latihan tercapai';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_workout_log() from public, anon, authenticated;

create function leaderboard_prev_since(p_period text) returns date as $$
  select case p_period
    when 'week' then leaderboard_since('week') - 7
    else (leaderboard_since('month') - interval '1 month')::date
  end;
$$ language sql stable;

drop function group_leaderboard(uuid, text, text, text);
drop function club_leaderboard(uuid, text, text, text);
drop function leaderboard_rows(uuid[], text, text, text);

create function leaderboard_rows(p_accounts uuid[], p_metric text, p_period text, p_sport text)
returns table(rank int, account_id uuid, username text, full_name text, sessions int, distance_m bigint, duration_min bigint,
  is_me boolean, prev_rank int, gap_to_next bigint, next_rank int, prev_champion boolean)
as $$
declare
  v_since date;
  v_prev date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_me uuid := current_account_id();
begin
  if p_metric not in ('distance', 'duration', 'sessions') then
    raise exception using errcode = '22023', message = 'Metrik tidak valid';
  end if;
  v_since := leaderboard_since(p_period);
  v_prev := leaderboard_prev_since(p_period);
  return query
  with logs as (
    select w.account_id as aid, w.performed_on >= v_since as is_cur, w.distance_m, w.duration_min
    from workout_logs w
    where w.account_id = any (p_accounts)
      and w.performed_on >= v_prev and w.performed_on <= v_today
      and (p_sport is null or w.sport = p_sport)
  ), totals as (
    select l.aid, l.is_cur,
      count(*)::int as n,
      coalesce(sum(l.distance_m), 0)::bigint as dist,
      coalesce(sum(l.duration_min), 0)::bigint as dur
    from logs l
    group by l.aid, l.is_cur
  ), scored as (
    select t.*, case p_metric when 'distance' then t.dist when 'duration' then t.dur else t.n::bigint end as score
    from totals t
  ), cur as (
    select s.*, rank() over (order by s.score desc) as rk from scored s where s.is_cur and s.score > 0
  ), prev as (
    select s.aid, rank() over (order by s.score desc) as rk from scored s where not s.is_cur and s.score > 0
  ), shown as (
    select c.* from cur c where c.rk <= 10 or c.aid = v_me
  )
  select sh.rk::int, sh.aid, a.username, a.full_name, sh.n, sh.dist, sh.dur, sh.aid = v_me,
    p.rk::int,
    (select min(c2.score) from cur c2 where c2.score > sh.score) - sh.score,
    (select max(c2.rk) from cur c2 where c2.score > sh.score)::int,
    coalesce(p.rk = 1, false)
  from shown sh
  join accounts a on a.id = sh.aid
  left join prev p on p.aid = sh.aid
  union all
  select null::int, p.aid, a.username, a.full_name,
    coalesce(c.n, 0), coalesce(c.dist, 0)::bigint, coalesce(c.dur, 0)::bigint, p.aid = v_me,
    1, null::bigint, null::int, true
  from prev p
  join accounts a on a.id = p.aid
  left join cur c on c.aid = p.aid
  where p.rk = 1 and not exists (select 1 from shown sh where sh.aid = p.aid)
  order by 1 nulls last, 3;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function leaderboard_rows(uuid[], text, text, text) from public, anon, authenticated;

create function group_leaderboard(p_group uuid, p_metric text, p_period text, p_sport text default null)
returns table(rank int, account_id uuid, username text, full_name text, sessions int, distance_m bigint, duration_min bigint,
  is_me boolean, prev_rank int, gap_to_next bigint, next_rank int, prev_champion boolean)
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
returns table(rank int, account_id uuid, username text, full_name text, sessions int, distance_m bigint, duration_min bigint,
  is_me boolean, prev_rank int, gap_to_next bigint, next_rank int, prev_champion boolean)
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

insert into permissions (code, module, label, owner_only, sort_order) values
  ('challenges.manage', 'Klub', 'Mengelola tantangan klub', false, 125);
insert into role_preset_permissions (preset_key, permission_code) values
  ('admin', 'challenges.manage'), ('kepala_pelatih', 'challenges.manage');
insert into role_permissions (role_id, permission_code)
select r.id, 'challenges.manage' from organization_roles r where r.preset_key in ('admin', 'kepala_pelatih')
on conflict do nothing;

create table challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  club_id uuid references clubs(id),
  created_by uuid default current_account_id() references accounts(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 3 and 100),
  metric text not null check (metric in ('sessions', 'distance', 'duration')),
  target int not null check (target between 1 and 100000000),
  sport text references club_types(code),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint challenges_scope check ((group_id is null) <> (club_id is null)),
  constraint challenges_dates check (ends_on >= starts_on and ends_on - starts_on <= 366)
);

create index challenges_group_idx on challenges (group_id) where group_id is not null;
create index challenges_club_idx on challenges (club_id) where club_id is not null;

create trigger a00_org_writable before insert or update or delete on challenges
  for each row execute function enforce_org_writable();

create table challenge_participants (
  challenge_id uuid not null references challenges(id) on delete cascade,
  account_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (challenge_id, account_id)
);

create index challenge_participants_account_idx on challenge_participants (account_id);

create function can_view_challenge(p_group uuid, p_club uuid) returns boolean as $$
  select case
    when p_group is not null then exists (
      select 1 from group_members gm where gm.group_id = p_group and gm.account_id = current_account_id() and gm.status = 'active'
    )
    else is_linked_club_member(p_club, current_account_id())
      or (p_club = current_club_id() and is_active_user() and has_permission('challenges.manage'))
  end;
$$ language sql stable security definer set search_path = public;

revoke execute on function can_view_challenge(uuid, uuid) from public, anon;
grant execute on function can_view_challenge(uuid, uuid) to authenticated;

create function can_manage_challenge(p_group uuid, p_club uuid) returns boolean as $$
  select case
    when p_group is not null then exists (
      select 1 from groups g where g.id = p_group and g.owner_id = current_account_id()
    ) and not exists (select 1 from accounts a where a.id = current_account_id() and a.social_banned_at is not null)
    else p_club = current_club_id() and is_active_user() and has_permission('challenges.manage')
  end;
$$ language sql stable security definer set search_path = public;

revoke execute on function can_manage_challenge(uuid, uuid) from public, anon, authenticated;

alter table challenges enable row level security;
revoke all on challenges from anon, authenticated;
grant select on challenges to authenticated;
create policy challenges_visible on challenges for select to authenticated
  using ((select can_view_challenge(group_id, club_id)));

alter table challenge_participants enable row level security;
revoke all on challenge_participants from anon, authenticated;
grant select on challenge_participants to authenticated;
create policy challenge_participants_visible on challenge_participants for select to authenticated
  using (
    account_id = (select current_account_id())
    or exists (select 1 from challenges c where c.id = challenge_participants.challenge_id and can_view_challenge(c.group_id, c.club_id))
  );

create function create_challenge(p_group uuid, p_club uuid, p_name text, p_metric text, p_target int, p_sport text, p_starts date, p_ends date)
returns uuid as $$
declare
  v_id uuid;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if current_account_id() is null or (p_group is null) = (p_club is null) or not can_manage_challenge(p_group, p_club) then
    raise exception using errcode = 'CH001', message = 'Anda tidak bisa membuat tantangan di sini';
  end if;
  if p_ends < v_today then
    raise exception using errcode = 'CH002', message = 'Tanggal selesai tidak boleh sebelum hari ini';
  end if;
  if (select count(*) from challenges c where c.ends_on >= v_today
      and (c.group_id = p_group or c.club_id = p_club)) >= 20 then
    raise exception using errcode = 'CH003', message = 'Maksimal 20 tantangan aktif';
  end if;
  insert into challenges (group_id, club_id, name, metric, target, sport, starts_on, ends_on)
  values (p_group, p_club, btrim(p_name), p_metric, p_target, p_sport, p_starts, p_ends)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_challenge(uuid, uuid, text, text, int, text, date, date) from public, anon;
grant execute on function create_challenge(uuid, uuid, text, text, int, text, date, date) to authenticated;

create function delete_challenge(p_id uuid) returns void as $$
declare
  c record;
begin
  select * into c from challenges where id = p_id;
  if c.id is null or not can_manage_challenge(c.group_id, c.club_id) then
    raise exception using errcode = 'CH001', message = 'Tantangan tidak ditemukan';
  end if;
  delete from challenges where id = p_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function delete_challenge(uuid) from public, anon;
grant execute on function delete_challenge(uuid) to authenticated;

create function join_challenge(p_id uuid) returns void as $$
declare
  c record;
  v_me uuid := current_account_id();
begin
  select * into c from challenges where id = p_id;
  if v_me is null or c.id is null
     or exists (select 1 from accounts a where a.id = v_me and a.social_banned_at is not null)
     or not (
       (c.group_id is not null and exists (select 1 from group_members gm where gm.group_id = c.group_id and gm.account_id = v_me and gm.status = 'active'))
       or (c.club_id is not null and is_linked_club_member(c.club_id, v_me))
     ) then
    raise exception using errcode = 'CH001', message = 'Tantangan tidak ditemukan';
  end if;
  if c.ends_on < (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'CH004', message = 'Tantangan sudah berakhir';
  end if;
  insert into challenge_participants (challenge_id, account_id) values (p_id, v_me) on conflict do nothing;
  perform award_challenge_finisher(v_me, p_id);
end;
$$ language plpgsql security definer set search_path = public;

create function leave_challenge(p_id uuid) returns void as $$
  delete from challenge_participants where challenge_id = p_id and account_id = current_account_id();
$$ language sql security definer set search_path = public;

revoke execute on function leave_challenge(uuid) from public, anon;
grant execute on function leave_challenge(uuid) to authenticated;

create function challenge_value(p_challenge uuid, p_account uuid) returns bigint as $$
  select case c.metric
    when 'sessions' then count(w.id)
    when 'distance' then coalesce(sum(w.distance_m), 0)
    else coalesce(sum(w.duration_min), 0)
  end
  from challenges c
  left join workout_logs w on w.account_id = p_account
    and w.performed_on between c.starts_on and least(c.ends_on, (now() at time zone 'Asia/Jakarta')::date)
    and (c.sport is null or w.sport = c.sport)
  where c.id = p_challenge
  group by c.metric;
$$ language sql stable security definer set search_path = public;

revoke execute on function challenge_value(uuid, uuid) from public, anon, authenticated;

create function challenge_progress(p_id uuid)
returns table(rank int, account_id uuid, username text, full_name text, value bigint, is_me boolean, done boolean)
as $$
declare
  c record;
  v_me uuid := current_account_id();
begin
  select * into c from challenges where id = p_id;
  if c.id is null or not can_view_challenge(c.group_id, c.club_id) then
    return;
  end if;
  return query
  with vals as (
    select p.account_id as aid, challenge_value(p_id, p.account_id) as v
    from challenge_participants p
    join accounts a on a.id = p.account_id
    where p.challenge_id = p_id and a.is_active and a.social_banned_at is null
      and (p.account_id = v_me or not is_blocked_pair(p.account_id))
  )
  select (rank() over (order by vals.v desc))::int, vals.aid, a.username, a.full_name, vals.v, vals.aid = v_me, vals.v >= c.target
  from vals
  join accounts a on a.id = vals.aid
  order by 1, 3
  limit 200;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function challenge_progress(uuid) from public, anon;
grant execute on function challenge_progress(uuid) to authenticated;

create table achievement_types (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text not null,
  kind text not null check (kind in ('sessions', 'distance', 'streak', 'finisher', 'champion')),
  threshold int,
  sort_order int not null default 0
);

insert into achievement_types (code, name, description, kind, threshold, sort_order) values
  ('first_session', 'Sesi pertama', 'Mencatat latihan pertama', 'sessions', 1, 1),
  ('sessions_10', '10 sesi', 'Mencatat 10 sesi latihan', 'sessions', 10, 2),
  ('sessions_50', '50 sesi', 'Mencatat 50 sesi latihan', 'sessions', 50, 3),
  ('sessions_100', '100 sesi', 'Mencatat 100 sesi latihan', 'sessions', 100, 4),
  ('distance_100km', '100 km', 'Total jarak latihan 100 km', 'distance', 100000, 5),
  ('streak_4', 'Streak 4 minggu', 'Memenuhi target mingguan 4 minggu berturut-turut', 'streak', 4, 6),
  ('streak_12', 'Streak 12 minggu', 'Memenuhi target mingguan 12 minggu berturut-turut', 'streak', 12, 7),
  ('challenge_finisher', 'Finisher', 'Menyelesaikan tantangan', 'finisher', null, 8),
  ('monthly_champion', 'Juara bulanan', 'Peringkat 1 sesi bulan lalu di grup', 'champion', null, 9);

alter table achievement_types enable row level security;
revoke all on achievement_types from anon, authenticated;
grant select on achievement_types to authenticated;
create policy achievement_types_read on achievement_types for select to authenticated using (true);

create table achievements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  code text not null references achievement_types(code),
  ref text check (ref is null or char_length(ref) <= 100),
  earned_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  created_at timestamptz not null default now(),
  constraint achievements_once unique nulls not distinct (account_id, code, ref)
);

create index achievements_account_idx on achievements (account_id, earned_on desc);

alter table achievements enable row level security;
revoke all on achievements from anon, authenticated;
grant select on achievements to authenticated;
create policy achievements_own on achievements for select to authenticated
  using (account_id = (select current_account_id()));

create function workout_streak(p_account uuid) returns int as $$
declare
  v_goal int;
  v_week date;
  v_current date;
  v_streak int := 0;
  v_count int;
  i int;
begin
  select weekly_sessions into v_goal from workout_goals where account_id = p_account;
  if v_goal is null then
    return 0;
  end if;
  v_current := (now() at time zone 'Asia/Jakarta')::date;
  v_current := v_current - (extract(isodow from v_current)::int - 1);
  for i in 0..260 loop
    v_week := v_current - 7 * i;
    select count(*) into v_count from workout_logs
    where account_id = p_account and performed_on between v_week and v_week + 6;
    if v_count >= v_goal then
      v_streak := v_streak + 1;
    elsif i > 0 then
      exit;
    end if;
  end loop;
  return v_streak;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function workout_streak(uuid) from public, anon, authenticated;

create function award_challenge_finisher(p_account uuid, p_challenge uuid) returns void as $$
  insert into achievements (account_id, code, ref)
  select p_account, 'challenge_finisher', c.id::text
  from challenges c
  join challenge_participants p on p.challenge_id = c.id and p.account_id = p_account
  where c.id = p_challenge and challenge_value(c.id, p_account) >= c.target
  on conflict do nothing;
$$ language sql security definer set search_path = public;

revoke execute on function award_challenge_finisher(uuid, uuid) from public, anon, authenticated;

revoke execute on function join_challenge(uuid) from public, anon;
grant execute on function join_challenge(uuid) to authenticated;

create function group_sessions_champion(p_group uuid, p_from date, p_to date) returns uuid as $$
  with totals as (
    select m.account_id, count(w.id) as n
    from group_members m
    join workout_logs w on w.account_id = m.account_id and w.performed_on >= p_from and w.performed_on < p_to
    where m.group_id = p_group and m.status = 'active'
    group by m.account_id
  ), ranked as (
    select account_id, n, rank() over (order by n desc) as rk from totals
  )
  select case when (select count(*) from group_members where group_id = p_group and status = 'active') >= 2
      and (select count(*) from ranked where rk = 1) = 1
    then (select account_id from ranked where rk = 1) end;
$$ language sql stable security definer set search_path = public;

revoke execute on function group_sessions_champion(uuid, date, date) from public, anon, authenticated;

create function award_achievements() returns trigger as $$
declare
  v_sessions int;
  v_distance bigint;
  v_streak int;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date;
  v_prev date;
  r record;
begin
  select count(*), coalesce(sum(distance_m), 0) into v_sessions, v_distance from workout_logs where account_id = new.account_id;
  v_streak := workout_streak(new.account_id);

  insert into achievements (account_id, code)
  select new.account_id, t.code
  from achievement_types t
  where (t.kind = 'sessions' and v_sessions >= t.threshold)
     or (t.kind = 'distance' and v_distance >= t.threshold)
     or (t.kind = 'streak' and v_streak >= t.threshold)
  on conflict do nothing;

  for r in
    select p.challenge_id from challenge_participants p
    join challenges c on c.id = p.challenge_id
    where p.account_id = new.account_id and new.performed_on between c.starts_on and c.ends_on
  loop
    perform award_challenge_finisher(new.account_id, r.challenge_id);
  end loop;

  if not exists (
    select 1 from workout_logs w
    where w.account_id = new.account_id and w.id <> new.id and w.created_at >= (v_month::timestamp at time zone 'Asia/Jakarta')
  ) then
    v_prev := (v_month - interval '1 month')::date;
    insert into achievements (account_id, code, ref, earned_on)
    select new.account_id, 'monthly_champion', 'group:' || g.group_id || ':' || to_char(v_prev, 'YYYY-MM'), v_today
    from group_members g
    where g.account_id = new.account_id and g.status = 'active'
      and group_sessions_champion(g.group_id, v_prev, v_month) = new.account_id
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function award_achievements() from public, anon, authenticated;

create trigger workout_logs_award after insert on workout_logs
  for each row execute function award_achievements();

CREATE OR REPLACE FUNCTION public.purge_organization(p_org uuid, p_execute boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
  v_reason text;
  v_clubs uuid[];
  v_steps constant text[] := array[
    'order_payments:t', 'order_items:t', 'cash_ledger:t', 'orders:t', 'payroll_runs:t', 'checkins:t', 'checkin_points:t',
    'resource_bookings:t', 'class_bookings:t', 'classes:t', 'class_types:t', 'resource_hours:t', 'resources:t',
    'coach_certifications:t', 'invoices:t', 'member_memberships:t', 'membership_packages:t', 'promos:t', 'products:t',
    'order_counters:t', 'club_module_overrides:t', 'consents:to', 'audit_log:to', 'challenges:t', 'club_join_requests:t', 'club_members:t',
    'organization_user_clubs:t', 'invitations:o', 'club_profiles:t', 'locations:t',
    'clubs:o', 'subscription_reminders:o', 'subscription_renewals:o', 'email_verifications:o',
    'organization_roles:o', 'organization_subscriptions:o', 'organization_users:o', 'organizations:id'
  ];
  v_step text;
  v_table text;
  v_scope text;
  v_cond text;
  v_count bigint;
  v_counts jsonb := '{}'::jsonb;
  r record;
begin
  select name into v_name from organizations where id = p_org;
  if v_name is null then
    raise exception using errcode = 'PG001', message = 'Organisasi tidak ditemukan';
  end if;
  if p_execute then
    if not coalesce((select enabled from platform_flags where key = 'purge_enabled'), false) then
      raise exception using errcode = 'PG002', message = 'Purge dimatikan';
    end if;
    select c.reason into v_reason from purge_candidates() c where c.organization_id = p_org;
    if v_reason is null then
      raise exception using errcode = 'PG001', message = 'Organisasi belum memenuhi syarat purge';
    end if;
  end if;

  v_clubs := array(select id from clubs where organization_id = p_org);

  if p_execute then
    perform set_config('ruzz.purge', 'on', true);
    update payroll_runs set cash_ledger_entry_id = null where club_id = any(v_clubs);
  end if;

  foreach v_step in array v_steps loop
    v_table := split_part(v_step, ':', 1);
    v_scope := split_part(v_step, ':', 2);
    v_cond := case v_scope
      when 't' then 'club_id = any($1)'
      when 'to' then 'club_id = any($1) or organization_id = $2'
      when 'o' then 'organization_id = $2'
      else 'id = $2'
    end;
    if p_execute then
      execute format('delete from %I where %s', v_table, v_cond) using v_clubs, p_org;
      get diagnostics v_count = row_count;
    else
      execute format('select count(*) from %I where %s', v_table, v_cond) into v_count using v_clubs, p_org;
    end if;
    v_counts := v_counts || jsonb_build_object(v_table, v_count);
  end loop;

  if p_execute then
    for r in
      select c.relname
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'club_id' and not a.attisdropped
      where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
    loop
      execute format('select count(*) from %I where club_id = any($1)', r.relname) into v_count using v_clubs;
      if v_count > 0 then
        raise exception using errcode = 'PG003', message = format('Data sisa di %s setelah purge', r.relname);
      end if;
    end loop;
    for r in
      select c.relname
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
      where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace and c.relname <> 'organization_purges'
    loop
      execute format('select count(*) from %I where organization_id = $1', r.relname) into v_count using p_org;
      if v_count > 0 then
        raise exception using errcode = 'PG003', message = format('Data sisa di %s setelah purge', r.relname);
      end if;
    end loop;
    insert into organization_purges (organization_id, organization_name, reason, counts)
    values (p_org, v_name, v_reason, v_counts);
  end if;

  return jsonb_build_object('dry_run', not p_execute, 'organization', v_name, 'counts', v_counts);
end;
$function$;
