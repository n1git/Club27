\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('la@t.test', 'luser.a', 'La', 'h'), ('lb@t.test', 'luser.b', 'Lb', 'h'),
  ('lc@t.test', 'luser.c', 'Lc', 'h'), ('ld@t.test', 'luser.d', 'Ld', 'h'),
  ('le@t.test', 'luser.e', 'Le', 'h'), ('lf@t.test', 'luser.f', 'Lf', 'h'),
  ('lg@t.test', 'luser.g', 'Lg', 'h'),
  ('lo@t.test', 'luser.o', 'Owner', 'h'), ('lk@t.test', 'luser.k', 'Coach', 'h'),
  ('m1@t.test', 'muser.1', 'M1', 'h'), ('m2@t.test', 'muser.2', 'M2', 'h'), ('m3@t.test', 'muser.3', 'M3', 'h'),
  ('mx@t.test', 'muser.x', 'Outside', 'h');
insert into accounts (email, username, full_name, password_hash)
select 'x' || i || '@t.test', 'xuser.' || i, 'X' || i, 'h' from generate_series(1, 12) i;

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

create function pg_temp.decide(p_id uuid, p_club uuid, p_email text, p_coach uuid)
returns uuid language plpgsql security definer as $f$
declare v uuid; v_saved text := current_setting('request.jwt.claims', true); v_actor uuid := (select id from club_profiles where account_id = pg_temp.uid(p_email) and club_id = p_club and role in ('owner', 'staff'));
begin
  perform set_config('request.jwt.claims', '', true);
  v := decide_club_join(p_id, p_club, v_actor, true, p_coach, null);
  perform set_config('request.jwt.claims', coalesce(v_saved, ''), true);
  return v;
end $f$;
grant execute on function pg_temp.decide(uuid, uuid, text, uuid) to public;

create temp table ctx (club uuid, org uuid, slug text, coach_profile uuid, grp uuid);
grant all on ctx to public;

do $$
declare
  r record; v_club uuid; v_org uuid; role_coach uuid; acc record; v_slug text; v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into r from register_organization('Org L', 'Club L', pg_temp.uid('lo@t.test'), 'plus', 'monthly', 'swimming');
  v_club := r.club_id; v_org := r.organization_id;
  update organization_subscriptions set seats = 20 where organization_id = v_org;
  select slug into v_slug from clubs where id = v_club;
  select id into role_coach from organization_roles where organization_id = v_org and preset_key = 'pelatih';
  perform create_invitation(v_org, v_club, 'staff', role_coach, 'lk@t.test', 'Coach', 'lh-1', pg_temp.uid('lo@t.test'));
  select * into acc from accept_invitation('lh-1', pg_temp.uid('lk@t.test'));
  insert into ctx values (v_club, v_org, v_slug, acc.out_profile_id, null);

  insert into friendships (requester_id, addressee_id, status) values
    (pg_temp.uid('la@t.test'), pg_temp.uid('lb@t.test'), 'accepted'),
    (pg_temp.uid('la@t.test'), pg_temp.uid('lc@t.test'), 'accepted'),
    (pg_temp.uid('la@t.test'), pg_temp.uid('lg@t.test'), 'accepted'),
    (pg_temp.uid('la@t.test'), pg_temp.uid('ld@t.test'), 'accepted');

  insert into workout_logs (account_id, sport, performed_on, duration_min, distance_m) values
    (pg_temp.uid('la@t.test'), 'swimming', v_today, 30, 4000), (pg_temp.uid('la@t.test'), 'swimming', v_today, 30, 6000),
    (pg_temp.uid('lb@t.test'), 'gym', v_today, 30, 5000),
    (pg_temp.uid('lc@t.test'), 'swimming', v_today, 90, 20000), (pg_temp.uid('lc@t.test'), 'swimming', v_today - 40, 90, 99000),
    (pg_temp.uid('ld@t.test'), 'swimming', v_today, 60, 50000),
    (pg_temp.uid('le@t.test'), 'swimming', v_today, 60, 50000),
    (pg_temp.uid('m1@t.test'), 'swimming', v_today, 40, 3000),
    (pg_temp.uid('m2@t.test'), 'swimming', v_today, 40, 2000),
    (pg_temp.uid('m3@t.test'), 'swimming', v_today, 40, 9000),
    (pg_temp.uid('mx@t.test'), 'swimming', v_today, 40, 9000);
  insert into workout_logs (account_id, sport, performed_on, duration_min, distance_m)
  select pg_temp.uid('x' || i || '@t.test'), 'swimming', v_today, 10, i * 1000 from generate_series(1, 12) i;
end $$;

set local role authenticated;

do $$
declare
  c ctx%rowtype; g uuid; n int; rid uuid; rows int; v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into c from ctx;

  perform pg_temp.personal('la@t.test');
  g := create_group('Lari Subuh', null);
  update ctx set grp = g;
  perform invite_to_group(g, pg_temp.uid('lb@t.test'));
  perform invite_to_group(g, pg_temp.uid('lc@t.test'));
  perform pg_temp.personal('lb@t.test'); perform respond_group_invite(g, true);
  perform pg_temp.personal('lc@t.test'); perform respond_group_invite(g, true);
  perform pg_temp.personal('la@t.test'); perform invite_to_group(g, pg_temp.uid('lg@t.test'));
  perform pg_temp.personal('lf@t.test');
  assert (select count(*) from group_leaderboard(g, 'distance', 'week')) = 0, 'a non-member gets nothing';

  perform pg_temp.personal('la@t.test');
  assert (select count(*) from group_leaderboard(g, 'distance', 'week')) = 3, 'three members trained this week';
  assert (select account_id from group_leaderboard(g, 'distance', 'week') where rank = 1) = pg_temp.uid('lc@t.test'), 'most distance ranks first';
  assert (select distance_m from group_leaderboard(g, 'distance', 'week') where is_me) = 10000 and (select sessions from group_leaderboard(g, 'distance', 'week') where is_me) = 2, 'own totals are summed';
  assert (select account_id from group_leaderboard(g, 'sessions', 'week') where rank = 1) = pg_temp.uid('la@t.test'), 'session count ranks';
  assert (select count(*) from group_leaderboard(g, 'distance', 'week', 'gym')) = 1, 'sport filter';
  assert (select count(*) from group_leaderboard(g, 'distance', 'month')) >= 3, 'month board';
  assert (select distance_m from group_leaderboard(g, 'distance', 'month') where account_id = pg_temp.uid('lc@t.test')) <= 119000, 'old logs stay out of long totals';
  assert not exists (select 1 from group_leaderboard(g, 'distance', 'week') where account_id = pg_temp.uid('lg@t.test')), 'invited members are not ranked';
  assert not exists (select 1 from group_leaderboard(g, 'distance', 'week') where account_id = pg_temp.uid('ld@t.test')), 'accounts outside the group are not ranked';
  begin perform * from group_leaderboard(g, 'speed', 'week'); assert false, 'metric is checked'; exception when sqlstate '22023' then null; end;
  begin perform * from group_leaderboard(g, 'distance', 'year'); assert false, 'period is checked'; exception when sqlstate '22023' then null; end;

  perform pg_temp.personal('lg@t.test');
  assert (select count(*) from group_leaderboard(g, 'distance', 'week')) = 0, 'an invited account gets nothing';

  reset role;
  insert into blocks (blocker_id, blocked_id) values (pg_temp.uid('lc@t.test'), pg_temp.uid('lb@t.test'));
  set local role authenticated;
  perform pg_temp.personal('lb@t.test');
  assert not exists (select 1 from group_leaderboard(g, 'distance', 'week') where account_id = pg_temp.uid('lc@t.test')), 'blocked pair hidden (blocked side)';
  perform pg_temp.personal('lc@t.test');
  assert not exists (select 1 from group_leaderboard(g, 'distance', 'week') where account_id = pg_temp.uid('lb@t.test')), 'blocked pair hidden (blocking side)';
  perform pg_temp.personal('la@t.test');
  assert (select count(*) from group_leaderboard(g, 'distance', 'week')) = 3, 'others still see both';

  reset role;
  update accounts set social_banned_at = now() where id = pg_temp.uid('lc@t.test');
  set local role authenticated;
  perform pg_temp.personal('la@t.test');
  assert not exists (select 1 from group_leaderboard(g, 'distance', 'week') where account_id = pg_temp.uid('lc@t.test')), 'banned account hidden';
  perform pg_temp.personal('lc@t.test');
  assert (select count(*) from group_leaderboard(g, 'distance', 'week')) = 0, 'banned account sees nothing';
  reset role;
  update accounts set social_banned_at = null where id = pg_temp.uid('lc@t.test');
  delete from blocks;
  set local role authenticated;

end $$;

do $$
declare
  c ctx%rowtype; g uuid;
begin
  select * into c from ctx;
  perform pg_temp.personal('la@t.test');
  g := create_group('Besar', null);
  reset role;
  insert into group_members (group_id, account_id, role, status)
  select g, pg_temp.uid('x' || i || '@t.test'), 'member', 'active' from generate_series(1, 12) i;
  set local role authenticated;
  perform pg_temp.personal('x1@t.test');
  assert (select count(*) from group_leaderboard(g, 'distance', 'week')) = 11, 'top ten plus the caller when outside it';
  assert (select count(*) from group_leaderboard(g, 'distance', 'week') where rank <= 10) = 10, 'ten ranked rows';
  assert (select rank from group_leaderboard(g, 'distance', 'week') where is_me) = 13, 'own rank is shown when outside the top ten';
  perform pg_temp.personal('x12@t.test');
  assert (select count(*) from group_leaderboard(g, 'distance', 'week')) = 10, 'no extra row when inside the top ten';
  assert (select account_id from group_leaderboard(g, 'distance', 'week') where rank = 1) = pg_temp.uid('x12@t.test'), 'highest distance first';
end $$;

do $$
declare
  c ctx%rowtype; rid uuid; mid uuid; n int;
  adult date := ((now() at time zone 'Asia/Jakarta')::date - interval '30 years')::date;
  pv text := '2026-10-12';
  e text;
begin
  select * into c from ctx;
  foreach e in array array['m1@t.test', 'm2@t.test', 'm3@t.test'] loop
    perform pg_temp.personal(e);
    rid := request_club_join(c.slug, 'Anggota', adult, null, null, pv);
    perform pg_temp.decide(rid, c.club, 'lo@t.test', c.coach_profile);
  end loop;

  perform pg_temp.personal('m1@t.test');
  assert (select count(*) from my_leaderboard_clubs() where not opted_in) = 1, 'opt-in defaults to off';
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week')) = 0, 'nobody opted in yet';
  perform set_leaderboard_optin(c.club, true);
  perform pg_temp.personal('m2@t.test'); perform set_leaderboard_optin(c.club, true);
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week')) = 2, 'opted-in members appear';
  assert (select account_id from club_leaderboard(c.club, 'distance', 'week') where rank = 1) = pg_temp.uid('m1@t.test'), 'ranked by distance';
  perform pg_temp.personal('m3@t.test');
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week')) = 2, 'a member who did not opt in can still look';
  assert not exists (select 1 from club_leaderboard(c.club, 'distance', 'week') where account_id = pg_temp.uid('m3@t.test')), 'a member who did not opt in is absent';

  perform pg_temp.personal('mx@t.test');
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week')) = 0, 'an outsider gets nothing';
  begin perform set_leaderboard_optin(c.club, true); assert false, 'an outsider cannot opt in'; exception when sqlstate '42501' then null; end;

  perform pg_temp.inclub('lk@t.test', c.club);
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week')) = 0, 'a coach without members.view_all gets nothing';
  perform pg_temp.inclub('lo@t.test', c.club);
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week')) = 2, 'the owner sees the board';
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week', 'gym')) = 0, 'sport filter on the club board';

  perform pg_temp.personal('m1@t.test');
  perform set_leaderboard_optin(c.club, false);
  assert not exists (select 1 from club_leaderboard(c.club, 'distance', 'week') where account_id = pg_temp.uid('m1@t.test')), 'opting out removes the member at once';
  perform pg_temp.inclub('lo@t.test', c.club);
  assert (select count(*) from club_leaderboard(c.club, 'distance', 'week')) = 1, 'the owner no longer sees the member';

  reset role;
  update club_members set is_active = false where profile_id = (select id from club_profiles where account_id = pg_temp.uid('m2@t.test') and club_id = c.club);
  assert (select count(*) from club_leaderboard_optins where account_id = pg_temp.uid('m2@t.test')) = 0, 'leaving the club clears the opt-in';
  update club_members set is_active = true where profile_id = (select id from club_profiles where account_id = pg_temp.uid('m2@t.test') and club_id = c.club);
  assert (select count(*) from club_leaderboard_optins where account_id = pg_temp.uid('m2@t.test')) = 0, 'rejoining does not bring the opt-in back';
  set local role authenticated;

  perform pg_temp.personal('m3@t.test');
  begin perform * from club_leaderboard_optins; assert false, 'opt-in table is closed'; exception when insufficient_privilege then null; end;
  perform pg_temp.personal('le@t.test');
  assert (select count(*) from workout_logs where account_id <> pg_temp.uid('le@t.test')) = 0, 'workout logs stay private';
end $$;

do $$
declare
  p uuid;
begin
  perform pg_temp.personal('la@t.test');
  p := create_post('Pagi ini');
  perform pg_temp.personal('lb@t.test'); insert into post_reactions (post_id) values (p);
  perform pg_temp.personal('lc@t.test'); insert into post_reactions (post_id) values (p);

  perform pg_temp.personal('la@t.test');
  assert (select count(*) from kudos_for_posts(array[p])) = 2, 'author sees both kudos';
  assert (select count(*) from kudos_for_posts(array[p]) where username is not null) = 2, 'friends are named';

  reset role;
  insert into blocks (blocker_id, blocked_id) values (pg_temp.uid('lc@t.test'), pg_temp.uid('lb@t.test'));
  set local role authenticated;
  perform pg_temp.personal('lb@t.test');
  assert (select count(*) from kudos_for_posts(array[p])) = 1, 'a blocked giver is not counted for the other side';

  reset role;
  delete from blocks;
  set local role authenticated;
  perform pg_temp.personal('ld@t.test');
  assert (select count(*) from kudos_for_posts(array[p])) = 2, 'a friend of the author counts every giver';
  assert (select count(*) from kudos_for_posts(array[p]) where username is not null) = 0, 'givers unrelated to the viewer stay unnamed';
  perform pg_temp.personal('le@t.test');
  assert (select count(*) from kudos_for_posts(array[p])) = 0, 'a stranger sees no kudos';
end $$;

do $$
declare n int;
begin
  reset role;
  select count(*) into n
  from pg_class c
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'club_id' and not a.attisdropped
  where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
    and c.relname not in ('audit_log', 'consents', 'organization_user_clubs', 'club_join_requests')
    and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'a00_org_writable');
  assert n = 0, 'every club table carries the read-only guard';
end $$;

rollback;
