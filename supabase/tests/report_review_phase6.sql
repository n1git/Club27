\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values ('ra@t.test', 'ruser.a', 'Ra', 'h');

create function pg_temp.act() returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select id from accounts where email = 'ra@t.test'), 'role', 'authenticated', 'club_id', '',
    'account_id', (select id from accounts where email = 'ra@t.test'), 'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.act() to public;

set local role authenticated;

do $$
begin
  perform pg_temp.act();
  insert into reports (target_type, target_id, reason) values ('post', gen_random_uuid(), 'konten tidak pantas');
end $$;

do $$
begin
  perform pg_temp.act();
  begin
    insert into reports (target_type, target_id, reason, status) values ('post', gen_random_uuid(), 'konten tidak pantas', 'dismissed');
    assert false, 'users cannot set the review status';
  exception when insufficient_privilege then null; end;
  begin
    insert into reports (target_type, target_id, reason, reviewed_by) values ('post', gen_random_uuid(), 'konten tidak pantas', null);
    assert false, 'users cannot set review columns';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$
begin
  insert into reports (reporter_id, target_type, target_id, reason)
  values ((select id from accounts where email = 'ra@t.test'), 'post', gen_random_uuid(), 'konten tidak pantas');
  assert (select count(*) from reports where status = 'open') = 2 and (select count(*) from reports where status <> 'open') = 0, 'new reports are open';
  begin update reports set status = 'x'; assert false, 'status check'; exception when check_violation then null; end;
end $$;
rollback;
\echo report_review_phase6 OK
