\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('wa@t.test', 'wuser.a', 'A', 'h'), ('wb@t.test', 'wuser.b', 'B', 'h');

create function pg_temp.act(p_email text, p_iat bigint default null) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select id from accounts where email = p_email), 'role', 'authenticated', 'club_id', '',
    'account_id', (select id from accounts where email = p_email),
    'iat', coalesce(p_iat, extract(epoch from now())::bigint)
  )::text, true)
$f$;
grant execute on function pg_temp.act(text, bigint) to public;

set local role authenticated;

do $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
  n int;
begin
  perform pg_temp.act('wa@t.test');
  insert into workout_logs (sport, performed_on, duration_min, distance_m, notes) values ('swimming', today, 45, 1500, 'pagi');
  insert into workout_logs (sport, performed_on, duration_min) values ('swimming', today - 1, 30);
  assert (select count(*) from workout_logs) = 2, 'own logs are visible';

  perform pg_temp.act('wb@t.test');
  assert (select count(*) from workout_logs) = 0, 'other accounts see nothing';
  update workout_logs set duration_min = 1;
  get diagnostics n = row_count;
  assert n = 0, 'other accounts cannot update';
  delete from workout_logs;
  get diagnostics n = row_count;
  assert n = 0, 'other accounts cannot delete';
  begin
    insert into workout_logs (account_id, sport, performed_on, duration_min)
    values ((select id from accounts where email = 'wa@t.test'), 'swimming', today, 10);
    assert false, 'cannot write for another account';
  exception when insufficient_privilege or sqlstate '42501' then null; end;

  begin insert into workout_logs (sport, performed_on, duration_min) values ('swimming', today + 1, 10); assert false, 'future date'; exception when sqlstate 'WL002' then null; end;
  begin insert into workout_logs (sport, performed_on, duration_min) values ('swimming', today, 0); assert false, 'duration min'; exception when check_violation then null; end;
  begin insert into workout_logs (sport, performed_on, duration_min) values ('swimming', today, 1441); assert false, 'duration max'; exception when check_violation then null; end;
  begin insert into workout_logs (sport, performed_on, duration_min, notes) values ('swimming', today, 10, repeat('x', 2001)); assert false, 'notes length'; exception when check_violation then null; end;
  begin insert into workout_logs (sport, performed_on, duration_min) values ('nonexistent', today, 10); assert false, 'sport must exist'; exception when foreign_key_violation then null; end;
  begin insert into workout_logs (sport, performed_on, duration_min) values ('swimming', date '1999-12-31', 10); assert false, 'date floor'; exception when check_violation then null; end;

  perform pg_temp.act('wa@t.test', 1);
  assert (select count(*) from workout_logs) = 2, 'sanity: a fresh token still works';
  perform pg_temp.act('wa@t.test');
  insert into workout_goals (weekly_sessions) values (3);
  assert (select weekly_sessions from workout_goals) = 3, 'goal stored';
  begin insert into workout_goals (weekly_sessions) values (4); assert false, 'one goal per account'; exception when unique_violation then null; end;
  begin update workout_goals set weekly_sessions = 22; assert false, 'goal range'; exception when check_violation then null; end;
  perform pg_temp.act('wb@t.test');
  assert (select count(*) from workout_goals) = 0, 'goals are private';

  perform set_config('request.jwt.claims', '', true);
  assert (select count(*) from workout_logs) = 0, 'no token, no rows';
  begin insert into workout_logs (sport, performed_on, duration_min) values ('swimming', today, 10); assert false, 'no token cannot write'; exception when insufficient_privilege or not_null_violation or sqlstate '42501' then null; end;
end $$;

reset role;

do $$
begin
  update accounts set sessions_valid_after = now() + interval '1 hour' where email = 'wa@t.test';
  perform pg_temp.act('wa@t.test');
end $$;
set local role authenticated;
do $$
begin
  assert (select count(*) from workout_logs) = 0, 'sessions revoked after a password change see nothing';
end $$;
reset role;

delete from accounts where email = 'wa@t.test';
do $$ begin assert (select count(*) from workout_logs) = 0, 'logs follow the account'; end $$;

rollback;
\echo workout_logs_phase2 OK
