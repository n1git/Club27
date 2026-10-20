\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('qa@t.test', 'quser.a', 'Qa Nama', 'h'), ('qb@t.test', 'quser.b', 'Qb Nama', 'h'),
  ('qc@t.test', 'quser.c', 'Qc Nama', 'h'), ('qd@t.test', 'quser.d', 'Qd Nama', 'h'),
  ('qe@t.test', 'quser.e', 'Qe Nama', 'h');

select register_organization('Org Uji Profil', 'Klub Uji Profil', (select id from accounts where email = 'qa@t.test'), 'plus', 'monthly', 'swimming');
insert into accounts (email, username, full_name, password_hash) values ('qm@t.test', 'quser.minor', 'Qm Anak', 'h'), ('qt@t.test', 'quser.adult', 'Qt Dewasa', 'h');
insert into club_members (club_id, full_name, date_of_birth) select id, 'Qm Anak', (now() at time zone 'Asia/Jakarta')::date - interval '12 years' from clubs where name = 'Klub Uji Profil';
insert into club_members (club_id, full_name, date_of_birth) select id, 'Qt Dewasa', (now() at time zone 'Asia/Jakarta')::date - interval '30 years' from clubs where name = 'Klub Uji Profil';
select activate_member_account((select id from club_members where full_name = 'Qm Anak'), (select id from accounts where email = 'qm@t.test'));
select activate_member_account((select id from club_members where full_name = 'Qt Dewasa'), (select id from accounts where email = 'qt@t.test'));
update accounts set public_profile = true where email in ('qm@t.test', 'qt@t.test');

create function pg_temp.act(p_email text) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select id from accounts where email = p_email), 'role', 'authenticated', 'club_id', '',
    'account_id', (select id from accounts where email = p_email), 'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.act(text) to public;

create function pg_temp.uid(p_email text) returns uuid language sql security definer as $f$
  select id from accounts where email = p_email
$f$;
grant execute on function pg_temp.uid(text) to public;

do $$
begin
  assert (select not public_profile and not public_search_ok from accounts where email = 'qa@t.test'), 'both flags default to off';
  begin update accounts set public_search_ok = true where email = 'qa@t.test'; assert false, 'search without profile'; exception when check_violation then null; end;
  assert username_reserved('workouts') and username_reserved('p') and username_reserved('robots.txt') and username_reserved('sitemap.xml'), 'routes and root files are reserved';
  assert username_reserved('admin') and username_reserved('ruzz') and username_reserved('club27') and username_reserved('www'), 'old names stay reserved';
  assert not username_reserved('budi.santoso'), 'normal names are free';
  begin insert into accounts (email, username, full_name, password_hash) values ('qz@t.test', 'workouts', 'Z', 'h'); assert false, 'reserved insert'; exception when sqlstate '23514' then null; end;
  begin update accounts set username = 'friends' where email = 'qa@t.test'; assert false, 'reserved rename'; exception when sqlstate '23514' then null; end;
end $$;

set local role anon;

do $$
begin
  assert (select count(*) from public_profile_by_username('quser.b')) = 0, 'off by default: nothing for anon';
  begin perform profile_by_username('quser.b'); assert false, 'anon cannot call the signed-in lookup'; exception when insufficient_privilege then null; end;
  begin perform count(*) from accounts; assert false, 'anon cannot read accounts'; exception when insufficient_privilege then null; end;
end $$;

reset role;
update accounts set public_profile = true where email in ('qb@t.test', 'qd@t.test');
update accounts set public_search_ok = true where email = 'qb@t.test';
update accounts set is_active = false where email = 'qd@t.test';
update accounts set public_profile = true, social_banned_at = now() where email = 'qe@t.test';
set local role anon;

do $$
declare r record;
begin
  select * into r from public_profile_by_username(' QUSER.B ');
  assert r.username = 'quser.b' and r.full_name = 'Qb Nama' and r.public_search_ok, 'public profile found, case and space insensitive';
  assert (select count(*) from public_profile_by_username('quser.c')) = 0, 'private account: nothing';
  assert (select count(*) from public_profile_by_username('quser.d')) = 0, 'inactive account: nothing';
  assert (select count(*) from public_profile_by_username('quser.e')) = 0, 'banned account: nothing';
  assert (select count(*) from public_profile_by_username('nobody.here')) = 0, 'unknown: nothing';
  assert (select count(*) from public_profile_by_username('admin')) = 0, 'reserved: nothing';
  assert (select count(*) from public_profile_by_username('')) = 0, 'empty: nothing';
  assert (select count(*) from public_profile_by_username('quser.minor')) = 0, 'under-18 member account: nothing, even when the flag is on';
  assert (select count(*) from public_profile_by_username('quser.adult')) = 1, 'adult member account with the flag on is found';
end $$;

reset role;
update accounts set is_active = true where email = 'qd@t.test';
update accounts set social_banned_at = null where email = 'qe@t.test';
update accounts set public_profile = false where email = 'qe@t.test';

set local role authenticated;

do $$
declare r record;
begin
  perform pg_temp.act('qa@t.test');
  assert (select relation from profile_by_username('quser.a')) = 'self', 'self';
  assert (select relation from profile_by_username('quser.b')) = 'none', 'stranger: exact lookup works without a public profile';
  assert (select relation from profile_by_username('QUSER.C')) = 'none', 'case-insensitive';
  assert (select count(*) from profile_by_username('nobody.here')) = 0 and (select count(*) from profile_by_username('admin')) = 0, 'unknown and reserved: nothing';
  perform request_friend('quser.b');
  assert (select relation from profile_by_username('quser.b')) = 'pending_out', 'pending out';
  perform pg_temp.act('qb@t.test');
  assert (select relation from profile_by_username('quser.a')) = 'pending_in', 'pending in';
  perform respond_friend((select id from friendships where requester_id = pg_temp.uid('qa@t.test')), true);
  assert (select relation from profile_by_username('quser.a')) = 'friends', 'friends';
  perform block_account(pg_temp.uid('qc@t.test'));
  assert (select count(*) from profile_by_username('quser.c')) = 0, 'blocked by me: nothing';
  perform pg_temp.act('qc@t.test');
  assert (select count(*) from profile_by_username('quser.b')) = 0, 'blocked by them: nothing';
  assert (select relation from profile_by_username('quser.c')) = 'self', 'self still works';
end $$;

reset role;
update accounts set is_active = false where email = 'qd@t.test';
update accounts set social_banned_at = now() where email = 'qe@t.test';
set local role authenticated;

do $$
begin
  perform pg_temp.act('qa@t.test');
  assert (select count(*) from profile_by_username('quser.minor')) = 0, 'under-18 member account: nothing for the signed-in lookup too';
  assert (select count(*) from profile_by_username('quser.adult')) = 1, 'adult member account is found';
  assert (select count(*) from profile_by_username('quser.d')) = 0, 'inactive: nothing';
  assert (select count(*) from profile_by_username('quser.e')) = 0, 'banned: nothing';
  assert (select count(*) from public_profile_by_username('quser.b')) = 1, 'signed-in callers may also use the public lookup';
end $$;

rollback;
