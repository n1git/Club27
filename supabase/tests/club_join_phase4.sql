\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('jo@t.test', 'juser.o', 'Own', 'h'), ('jc@t.test', 'juser.c', 'Coach', 'h'),
  ('jj@t.test', 'juser.j', 'Joiner', 'h'), ('jk@t.test', 'juser.k', 'Kid', 'h'),
  ('jx@t.test', 'juser.x', 'Other', 'h'), ('jl@t.test', 'juser.l', 'Linker', 'h');

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

create function pg_temp.decide(p_id uuid, p_club uuid, p_email text, p_approve boolean, p_coach uuid default null, p_member uuid default null)
returns uuid language plpgsql security definer as $f$
declare v uuid; v_saved text := current_setting('request.jwt.claims', true); v_actor uuid := (select id from club_profiles where account_id = pg_temp.uid(p_email) and club_id = p_club and role in ('owner', 'staff'));
begin
  perform set_config('request.jwt.claims', '', true);
  v := decide_club_join(p_id, p_club, v_actor, p_approve, p_coach, p_member);
  perform set_config('request.jwt.claims', coalesce(v_saved, ''), true);
  return v;
end $f$;
grant execute on function pg_temp.decide(uuid, uuid, text, boolean, uuid, uuid) to public;

create temp table ctx (club uuid, org uuid, slug text, role_coach uuid, coach_profile uuid);
grant all on ctx to public;

do $$
declare
  r record; v_club uuid; v_org uuid; role_coach uuid; acc record; v_slug text;
begin
  select * into r from register_organization('Org J', 'Club J', pg_temp.uid('jo@t.test'), 'plus', 'monthly', 'swimming');
  v_club := r.club_id; v_org := r.organization_id;
  update organization_subscriptions set seats = 20 where organization_id = v_org;
  select slug into v_slug from clubs where id = v_club;
  select id into role_coach from organization_roles where organization_id = v_org and preset_key = 'pelatih';
  perform create_invitation(v_org, v_club, 'staff', role_coach, 'jc@t.test', 'Coach', 'jh-1', pg_temp.uid('jo@t.test'));
  select * into acc from accept_invitation('jh-1', pg_temp.uid('jc@t.test'));
  insert into ctx values (v_club, v_org, v_slug, role_coach, acc.out_profile_id);
end $$;

set local role authenticated;

do $$
declare
  c ctx%rowtype; rid uuid; rid2 uuid; rid3 uuid; mid uuid; n int; v_pv text := '2026-10-12';
  adult date := ((now() at time zone 'Asia/Jakarta')::date - interval '30 years')::date;
  kid date := ((now() at time zone 'Asia/Jakarta')::date - interval '10 years')::date;
  existing uuid;
begin
  select * into c from ctx;

  perform pg_temp.personal('jj@t.test');
  begin perform request_club_join('tidak-ada', 'Joiner', adult, null, null, v_pv); assert false, 'unknown code'; exception when sqlstate 'JN001' then null; end;
  begin perform request_club_join(c.slug, 'Joiner', kid, null, null, v_pv); assert false, 'minors cannot self join'; exception when sqlstate 'JN003' then null; end;
  begin perform request_club_join(c.slug, 'J', adult, null, null, v_pv); assert false, 'name length'; exception when check_violation then null; end;
  rid := request_club_join(upper(c.slug), 'Joiner', adult, '0812', 'saya mau gabung', v_pv);
  begin perform request_club_join(c.slug, 'Joiner', adult, null, null, v_pv); assert false, 'duplicate pending'; exception when sqlstate 'JN005' then null; end;
  assert (select count(*) from club_join_requests) = 1, 'requester sees own request';

  perform pg_temp.personal('jx@t.test');
  assert (select count(*) from club_join_requests) = 0, 'others see nothing';
  begin perform cancel_club_join(rid); assert false, 'cannot cancel another request'; exception when sqlstate 'JN001' then null; end;
  begin insert into club_join_requests (club_id, full_name, date_of_birth, privacy_version) values (c.club, 'Xx', adult, 'v'); assert false, 'direct insert closed'; exception when insufficient_privilege then null; end;

  perform pg_temp.personal('jo@t.test');
  begin perform request_club_join(c.slug, 'Own', adult, null, null, v_pv); assert false, 'members of the club cannot request'; exception when sqlstate 'JN004' then null; end;

  perform pg_temp.inclub('jc@t.test', c.club);
  assert (select count(*) from club_join_requests) = 0, 'a coach sees no requests';
  begin perform decide_club_join(rid, c.club, null, true, c.coach_profile); assert false, 'decide is server only'; exception when insufficient_privilege then null; end;

  perform pg_temp.inclub('jo@t.test', c.club);
  assert (select count(*) from club_join_requests) = 1, 'the club owner sees the request';
  begin perform pg_temp.decide(rid, c.club, 'jo@t.test', true); assert false, 'a coach is required'; exception when sqlstate 'JN007' then null; end;
  mid := pg_temp.decide(rid, c.club, 'jo@t.test', true, c.coach_profile);
  assert (select profile_id is not null and coach_id = c.coach_profile and full_name = 'Joiner' and contact_phone = '0812' from club_members where id = mid), 'member created and linked';
  assert (select count(*) from consents where subject_id = mid and kind = 'member_data' and version = v_pv) = 1, 'member consent recorded with the requested version';
  assert (select count(*) from club_profiles where account_id = pg_temp.uid('jj@t.test') and club_id = c.club and role = 'member') = 1, 'member profile exists';
  assert (select status = 'approved' and member_id = mid and decided_by is not null from club_join_requests where id = rid), 'request approved';
  assert (select count(*) from audit_log where action = 'member.join_approved' and target_id = mid) = 1, 'approval audited';
  begin perform pg_temp.decide(rid, c.club, 'jo@t.test', true, c.coach_profile); assert false, 'decided once'; exception when sqlstate 'JN001' then null; end;

  perform pg_temp.personal('jj@t.test');
  begin perform request_club_join(c.slug, 'Joiner', adult, null, null, v_pv); assert false, 'already a member'; exception when sqlstate 'JN004' then null; end;

  perform pg_temp.personal('jx@t.test');
  rid2 := request_club_join(c.slug, 'Other', adult, null, null, v_pv);
  perform cancel_club_join(rid2);
  assert (select status from club_join_requests where id = rid2) = 'cancelled', 'own request cancelled';
  rid2 := request_club_join(c.slug, 'Other', adult, null, null, v_pv);
  perform pg_temp.inclub('jo@t.test', c.club);
  assert pg_temp.decide(rid2, c.club, 'jo@t.test', false) is null, 'reject returns nothing';
  assert (select status from club_join_requests where id = rid2) = 'rejected', 'rejected';
  assert (select count(*) from club_profiles where account_id = pg_temp.uid('jx@t.test')) = 0, 'rejected account gets nothing';
  perform pg_temp.personal('jx@t.test');
  rid2 := request_club_join(c.slug, 'Other', adult, null, null, v_pv);
  assert rid2 is not null, 'can ask again after rejection';
  perform cancel_club_join(rid2);

  reset role;
  insert into club_members (club_id, full_name, date_of_birth, coach_id) values (c.club, 'Linker Lama', adult, c.coach_profile) returning id into existing;
  insert into consents (club_id, subject_type, subject_id, kind, version) values (c.club, 'member', existing, 'member_data', 'old');
  set local role authenticated;
  perform pg_temp.personal('jl@t.test');
  rid3 := request_club_join(c.slug, 'Linker Baru', adult, null, null, v_pv);
  perform pg_temp.inclub('jo@t.test', c.club);
  begin perform pg_temp.decide(rid3, c.club, 'jo@t.test', true, null, gen_random_uuid()); assert false, 'unknown member'; exception when sqlstate 'JN008' then null; end;
  assert pg_temp.decide(rid3, c.club, 'jo@t.test', true, null, existing) = existing, 'linking returns the existing member';
  assert (select profile_id is not null and full_name = 'Linker Lama' from club_members where id = existing), 'existing member now has an account';
  assert (select count(*) from consents where subject_id = existing) = 1, 'no duplicate consent when linking';

  perform set_club_module('member_portal', false);
  perform pg_temp.personal('jx@t.test');
  begin perform request_club_join(c.slug, 'Other', adult, null, null, v_pv); assert false, 'module off'; exception when sqlstate 'JN002' then null; end;
  perform pg_temp.inclub('jo@t.test', c.club);
  perform set_club_module('member_portal', true);

  perform pg_temp.personal('jx@t.test');
  rid2 := request_club_join(c.slug, 'Other', adult, null, null, v_pv);
  reset role;
  update organization_subscriptions set status = 'suspended' where organization_id = c.org;
  set local role authenticated;
  perform pg_temp.personal('jk@t.test');
  begin perform request_club_join(c.slug, 'Kid Adult', adult, null, null, v_pv); assert false, 'locked org'; exception when sqlstate 'JN002' then null; end;
  perform pg_temp.personal('jx@t.test');
  perform cancel_club_join(rid2);
  assert (select status from club_join_requests where id = rid2) = 'cancelled', 'cancel still works when the club is locked';
end $$;

reset role;

delete from accounts where email = 'jx@t.test';
do $$ begin assert (select count(*) from club_join_requests where account_id is not null) = 2 and not exists (select 1 from club_join_requests r where not exists (select 1 from accounts a where a.id = r.account_id)), 'requests follow their account'; end $$;
rollback;
\echo club_join_phase4 OK
