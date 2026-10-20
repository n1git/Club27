\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('ka@t.test', 'kuser.a', 'A', 'h'), ('kb@t.test', 'kuser.b', 'B', 'h'), ('kc@t.test', 'kuser.c', 'C', 'h'),
  ('ko@t.test', 'kuser.o', 'Owner', 'h'), ('kk@t.test', 'kuser.k', 'Coach', 'h'), ('km@t.test', 'kuser.m', 'Member', 'h');

create function pg_temp.uid(p_email text) returns uuid language sql security definer as $f$
  select id from accounts where email = p_email
$f$;
grant execute on function pg_temp.uid(text) to public;

create function pg_temp.personal(p_email text) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', pg_temp.uid(p_email), 'role', 'authenticated', 'club_id', '', 'account_id', pg_temp.uid(p_email),
    'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.personal(text) to public;

create function pg_temp.inclub(p_email text, p_club uuid) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select id from club_profiles where account_id = pg_temp.uid(p_email) and club_id = p_club and role in ('owner', 'staff')),
    'role', 'authenticated', 'club_id', p_club, 'account_id', pg_temp.uid(p_email), 'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.inclub(text, uuid) to public;

create temp table ctx (club uuid, grp uuid, week date, month date);
grant all on ctx to public;

do $$
declare
  r record; v_role uuid; v_member uuid; v_grp uuid;
  v_week date := leaderboard_since('week');
  v_month date := leaderboard_since('month');
begin
  select * into r from register_organization('Org K', 'Club K', pg_temp.uid('ko@t.test'), 'plus', 'monthly', 'swimming');
  update organization_subscriptions set seats = 20 where organization_id = r.organization_id;
  select id into v_role from organization_roles where organization_id = r.organization_id and preset_key = 'pelatih';
  perform create_invitation(r.organization_id, r.club_id, 'staff', v_role, 'kk@t.test', 'Coach', 'kh-1', pg_temp.uid('ko@t.test'));
  perform accept_invitation('kh-1', pg_temp.uid('kk@t.test'));
  insert into club_members (club_id, full_name, date_of_birth) values (r.club_id, 'Member', '1990-01-01') returning id into v_member;
  perform activate_member_account(v_member, pg_temp.uid('km@t.test'));

  insert into groups (owner_id, name) values (pg_temp.uid('ka@t.test'), 'Grup K') returning id into v_grp;
  insert into group_members (group_id, account_id, role, status) values
    (v_grp, pg_temp.uid('ka@t.test'), 'owner', 'active'), (v_grp, pg_temp.uid('kb@t.test'), 'member', 'active');
  insert into ctx values (r.club_id, v_grp, v_week, v_month);

  begin
    insert into workout_logs (account_id, sport, performed_on, duration_min, distance_m) values (pg_temp.uid('kc@t.test'), 'swimming', v_week, 10, 2000);
    assert false, 'swim faster than 150 m/min is rejected';
  exception when sqlstate 'WL003' then null; end;
  insert into workout_logs (account_id, sport, performed_on, duration_min, distance_m) values
    (pg_temp.uid('kc@t.test'), 'swimming', v_week, 10, 1500),
    (pg_temp.uid('kc@t.test'), 'gym', v_week, 10, 9000);
  assert (select count(*) from workout_logs where account_id = pg_temp.uid('kc@t.test')) = 2, 'limit applies only to sports with max_m_per_min';

  insert into workout_logs (account_id, sport, performed_on, duration_min) values
    (pg_temp.uid('ka@t.test'), 'gym', v_week - 3, 30), (pg_temp.uid('ka@t.test'), 'gym', v_week - 4, 30), (pg_temp.uid('ka@t.test'), 'gym', v_week - 5, 30),
    (pg_temp.uid('kb@t.test'), 'gym', v_week - 3, 30),
    (pg_temp.uid('ka@t.test'), 'gym', v_week, 30),
    (pg_temp.uid('kb@t.test'), 'gym', v_week, 30), (pg_temp.uid('kb@t.test'), 'gym', v_week, 30);
end $$;

set local role authenticated;

do $$
declare
  c ctx;
  ra record; rb record;
  v_ch uuid; v_club_ch uuid;
begin
  select * into c from ctx;

  perform pg_temp.personal('ka@t.test');
  select * into ra from group_leaderboard(c.grp, 'sessions', 'week') where account_id = pg_temp.uid('ka@t.test');
  select * into rb from group_leaderboard(c.grp, 'sessions', 'week') where account_id = pg_temp.uid('kb@t.test');
  assert rb.rank = 1 and rb.prev_rank = 2 and rb.gap_to_next is null and not rb.prev_champion, 'B leads now, was second';
  assert ra.rank = 2 and ra.prev_rank = 1 and ra.gap_to_next = 1 and ra.prev_champion, 'A dropped, one session behind, last week champion';

  assert exists (select 1 from achievements where code = 'first_session'), 'first session badge';
  perform pg_temp.personal('kb@t.test');
  assert (select count(*) from achievements) = 1, 'badges are private to their owner';
  perform pg_temp.personal('kc@t.test');
  assert (select count(*) from achievement_types) = 9, 'catalog is readable';

  perform pg_temp.personal('kb@t.test');
  begin
    perform create_challenge(c.grp, null, 'Sesi Minggu Ini', 'sessions', 3, null, c.week, c.week + 6);
    assert false, 'only the group owner creates group challenges';
  exception when sqlstate 'CH001' then null; end;

  perform pg_temp.personal('ka@t.test');
  begin
    perform create_challenge(c.grp, null, 'Lama', 'sessions', 3, null, c.week - 30, c.week - 20);
    assert false, 'ended challenge cannot be created';
  exception when sqlstate 'CH002' then null; end;
  v_ch := create_challenge(c.grp, null, 'Sesi Minggu Ini', 'sessions', 3, 'gym', c.week, c.week + 6);
  perform join_challenge(v_ch);

  perform pg_temp.personal('kb@t.test');
  assert (select count(*) from challenges) = 1, 'group member sees the challenge';
  perform join_challenge(v_ch);
  assert not exists (select 1 from achievements where code = 'challenge_finisher'), 'B (2 of 3 sessions) is not a finisher yet';
end $$;

do $$
declare
  c ctx;
  v_ch uuid;
begin
  select * into c from ctx;
  select id into v_ch from challenges limit 1;

  perform pg_temp.personal('kb@t.test');
  assert (select value from challenge_progress(v_ch) where is_me) = 2, 'progress counts sessions in the window';
  assert (select count(*) from challenge_progress(v_ch)) = 2, 'both participants listed';
  insert into workout_logs (sport, performed_on, duration_min) values ('gym', c.week, 30);
  assert exists (select 1 from achievements where code = 'challenge_finisher' and ref = v_ch::text), 'reaching the target awards the finisher badge';
  assert (select done from challenge_progress(v_ch) where is_me), 'progress marks done';

  perform pg_temp.personal('kc@t.test');
  assert (select count(*) from challenges) = 0, 'outsiders cannot see the challenge';
  assert (select count(*) from challenge_progress(v_ch)) = 0, 'outsiders get no progress';
  begin perform join_challenge(v_ch); assert false, 'outsiders cannot join'; exception when sqlstate 'CH001' then null; end;
  begin insert into challenges (group_id, name, metric, target, starts_on, ends_on) values (c.grp, 'x', 'sessions', 1, c.week, c.week); assert false, 'no direct insert'; exception when insufficient_privilege then null; end;

  perform pg_temp.personal('kb@t.test');
  perform leave_challenge(v_ch);
  assert (select count(*) from challenge_progress(v_ch)) = 1, 'leaving removes the participant';

  perform pg_temp.inclub('kk@t.test', c.club);
  begin
    perform create_challenge(null, c.club, 'Klub', 'distance', 1000, null, c.week, c.week + 6);
    assert false, 'coach without challenges.manage cannot create';
  exception when sqlstate 'CH001' then null; end;

  perform pg_temp.inclub('ko@t.test', c.club);
  v_ch := create_challenge(null, c.club, 'Renang 1 km', 'distance', 1000, 'swimming', c.week, c.week + 6);
  assert (select count(*) from challenges where club_id = c.club) = 1, 'manager sees club challenge';

  perform pg_temp.personal('km@t.test');
  assert (select count(*) from challenges where club_id = c.club) = 1, 'club member sees club challenge';
  perform join_challenge(v_ch);
  insert into workout_logs (sport, performed_on, duration_min, distance_m) values ('swimming', c.week, 10, 1200);
  assert exists (select 1 from achievements where code = 'challenge_finisher' and ref = v_ch::text), 'club challenge finisher';

  perform pg_temp.personal('ka@t.test');
  assert (select count(*) from challenges where club_id = c.club) = 0, 'non-members do not see club challenges';
  begin perform delete_challenge(v_ch); assert false, 'non-managers cannot delete'; exception when sqlstate 'CH001' then null; end;
end $$;

reset role;

do $$
declare
  c ctx;
  v_prev date;
begin
  select * into c from ctx;
  v_prev := (c.month - interval '1 month')::date;
  delete from achievements where code = 'monthly_champion';
  delete from workout_logs where account_id in (pg_temp.uid('ka@t.test'), pg_temp.uid('kb@t.test')) and performed_on >= c.month;
  update workout_logs set created_at = c.month::timestamp - interval '1 day' where account_id in (pg_temp.uid('ka@t.test'), pg_temp.uid('kb@t.test'));
  insert into workout_logs (account_id, sport, performed_on, duration_min, created_at) values
    (pg_temp.uid('ka@t.test'), 'gym', v_prev + 1, 30, c.month::timestamp - interval '1 day'),
    (pg_temp.uid('ka@t.test'), 'gym', v_prev + 2, 30, c.month::timestamp - interval '1 day'),
    (pg_temp.uid('ka@t.test'), 'gym', v_prev + 3, 30, c.month::timestamp - interval '1 day'),
    (pg_temp.uid('ka@t.test'), 'gym', v_prev + 4, 30, c.month::timestamp - interval '1 day'),
    (pg_temp.uid('ka@t.test'), 'gym', v_prev + 5, 30, c.month::timestamp - interval '1 day');
  delete from achievements where code = 'monthly_champion';
  insert into workout_logs (account_id, sport, performed_on, duration_min) values (pg_temp.uid('kb@t.test'), 'gym', (now() at time zone 'Asia/Jakarta')::date, 30);
  assert not exists (select 1 from achievements where code = 'monthly_champion'), 'runner-up gets no champion badge';
  insert into workout_logs (account_id, sport, performed_on, duration_min) values (pg_temp.uid('ka@t.test'), 'gym', (now() at time zone 'Asia/Jakarta')::date, 30);
  assert exists (select 1 from achievements where code = 'monthly_champion' and account_id = pg_temp.uid('ka@t.test')
    and ref = 'group:' || c.grp || ':' || to_char(v_prev, 'YYYY-MM')), 'last month group champion badge on first log this month';

  insert into workout_goals (account_id, weekly_sessions) values (pg_temp.uid('kc@t.test'), 1);
  insert into workout_logs (account_id, sport, performed_on, duration_min) values
    (pg_temp.uid('kc@t.test'), 'gym', c.week - 7, 30), (pg_temp.uid('kc@t.test'), 'gym', c.week - 14, 30), (pg_temp.uid('kc@t.test'), 'gym', c.week - 21, 30);
  assert workout_streak(pg_temp.uid('kc@t.test')) = 4, 'four consecutive weeks meeting the goal';
  assert exists (select 1 from achievements where code = 'streak_4' and account_id = pg_temp.uid('kc@t.test')), 'streak badge';

  assert not has_function_privilege('authenticated', 'award_achievements()', 'execute'), 'trigger function not callable';
  assert not has_function_privilege('authenticated', 'challenge_value(uuid, uuid)', 'execute'), 'helper not callable';
  assert exists (select 1 from role_permissions rp join organization_roles r on r.id = rp.role_id
    where r.preset_key = 'admin' and rp.permission_code = 'challenges.manage'), 'admin roles get challenges.manage';
  assert not exists (select 1 from role_permissions rp join organization_roles r on r.id = rp.role_id
    where r.preset_key = 'pelatih' and rp.permission_code = 'challenges.manage'), 'coaches do not';
end $$;

rollback;
\echo competition_phase1 OK
