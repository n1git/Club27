\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('ha@t.test', 'huser.a', 'A', 'h'), ('hb@t.test', 'huser.b', 'B', 'h');

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
  perform pg_temp.act('ha@t.test');
  insert into body_measurements (measured_on, height_cm, weight_kg) values (today, 170.5, 65.2);
  insert into body_measurements (measured_on, weight_kg) values (today - 1, 66);
  insert into body_measurements (measured_on, height_cm) values (today - 2, 170);
  assert (select count(*) from body_measurements) = 3, 'own rows are visible';
  update body_measurements set weight_kg = 64.9 where measured_on = today;
  get diagnostics n = row_count;
  assert n = 1, 'own row can be updated';
  assert (select weight_kg from body_measurements where measured_on = today) = 64.9, 'update stored';
  delete from body_measurements where measured_on = today - 2;
  get diagnostics n = row_count;
  assert n = 1, 'own row can be deleted';

  perform pg_temp.act('hb@t.test');
  assert (select count(*) from body_measurements) = 0, 'other accounts see nothing';
  update body_measurements set weight_kg = 100;
  get diagnostics n = row_count;
  assert n = 0, 'other accounts cannot update';
  delete from body_measurements;
  get diagnostics n = row_count;
  assert n = 0, 'other accounts cannot delete';
  begin
    insert into body_measurements (account_id, measured_on, weight_kg)
    values ((select id from accounts where email = 'ha@t.test'), today - 5, 70);
    assert false, 'cannot write for another account';
  exception when insufficient_privilege or sqlstate '42501' then null; end;
  insert into body_measurements (measured_on, weight_kg) values (today, 80);
  assert (select count(*) from body_measurements) = 1, 'same date is allowed for a different account';

  perform pg_temp.act('ha@t.test');
  begin insert into body_measurements (measured_on, weight_kg) values (today + 1, 60); assert false, 'future date'; exception when sqlstate 'BM002' then null; end;
  begin update body_measurements set measured_on = today + 1 where measured_on = today; assert false, 'future date on update'; exception when sqlstate 'BM002' then null; end;
  begin insert into body_measurements (measured_on, weight_kg) values (today, 60); assert false, 'one row per date'; exception when unique_violation then null; end;
  begin insert into body_measurements (measured_on) values (today - 10); assert false, 'at least one value'; exception when check_violation then null; end;
  begin insert into body_measurements (measured_on, height_cm) values (today - 10, 49.9); assert false, 'height min'; exception when check_violation then null; end;
  begin insert into body_measurements (measured_on, height_cm) values (today - 10, 250.1); assert false, 'height max'; exception when check_violation then null; end;
  begin insert into body_measurements (measured_on, weight_kg) values (today - 10, 19.9); assert false, 'weight min'; exception when check_violation then null; end;
  begin insert into body_measurements (measured_on, weight_kg) values (today - 10, 300.1); assert false, 'weight max'; exception when check_violation then null; end;
  begin insert into body_measurements (measured_on, weight_kg) values (date '1899-12-31', 60); assert false, 'date floor'; exception when check_violation then null; end;
  insert into body_measurements (measured_on, height_cm, weight_kg) values (today - 10, 50, 20), (today - 11, 250, 300);
  assert (select count(*) from body_measurements) = 4, 'boundary values are accepted';

  perform set_config('request.jwt.claims', '', true);
  assert (select count(*) from body_measurements) = 0, 'no token, no rows';
  begin insert into body_measurements (measured_on, weight_kg) values (today - 20, 60); assert false, 'no token cannot write'; exception when insufficient_privilege or not_null_violation or sqlstate '42501' then null; end;
end $$;

reset role;
set local role anon;
do $$
begin
  perform 1 from body_measurements;
  assert false, 'anon cannot read';
exception when insufficient_privilege then null;
end $$;
reset role;

do $$
begin
  assert not has_function_privilege('authenticated', 'enforce_body_measurement()', 'execute'), 'trigger function is not callable';
  insert into body_measurements (account_id, measured_on, weight_kg)
  select (select id from accounts where email = 'hb@t.test'), date '1950-01-01' + g, 60 from generate_series(1, 9999) g;
  begin
    insert into body_measurements (account_id, measured_on, weight_kg) values ((select id from accounts where email = 'hb@t.test'), date '1990-01-01', 60);
    assert false, 'row cap';
  exception when sqlstate 'BM001' then null; end;
  delete from body_measurements where account_id = (select id from accounts where email = 'hb@t.test') and measured_on < date '1990-01-01';

  update accounts set sessions_valid_after = now() + interval '1 hour' where email = 'ha@t.test';
  perform pg_temp.act('ha@t.test');
end $$;
set local role authenticated;
do $$
begin
  assert (select count(*) from body_measurements) = 0, 'sessions revoked after a password change see nothing';
end $$;
reset role;

delete from accounts where email = 'ha@t.test';
do $$
begin
  assert not exists (select 1 from body_measurements b where not exists (select 1 from accounts a where a.id = b.account_id)), 'no orphan rows';
  assert (select count(*) from body_measurements) = 1, 'deleting an account removes its rows and keeps others';
end $$;

rollback;
\echo health_phase1 OK
