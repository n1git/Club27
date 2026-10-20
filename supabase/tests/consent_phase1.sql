\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash, last_login_at, created_at) values
  ('ca@t.test', 'cuser.a', 'A', 'h', now(), now()),
  ('cold@t.test', 'cuser.old', 'Old', 'h', now() - interval '4 years', now() - interval '5 years');

create function pg_temp.act(p_email text) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select id from accounts where email = p_email), 'role', 'authenticated', 'club_id', '',
    'account_id', (select id from accounts where email = p_email), 'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.act(text) to public;

do $$
declare
  a uuid := (select id from accounts where email = 'ca@t.test');
  c uuid;
  n int;
begin
  insert into consents (subject_type, subject_id, kind, version) values ('account', a, 'terms_privacy', '2026-10-20') returning id into c;

  begin delete from consents where id = c; assert false, 'consents cannot be deleted'; exception when sqlstate 'CN001' then null; end;
  begin update consents set version = 'x' where id = c; assert false, 'version is immutable'; exception when sqlstate 'CN002' then null; end;
  begin update consents set accepted_at = now() - interval '1 day' where id = c; assert false, 'accepted_at is immutable'; exception when sqlstate 'CN002' then null; end;
  begin update consents set guardian_name = 'Wali' where id = c; assert false, 'guardian_name cannot be set'; exception when sqlstate 'CN002' then null; end;
  update consents set revoked_at = now() where id = c;
  get diagnostics n = row_count;
  assert n = 1, 'revoked_at can be set once';
  begin update consents set revoked_at = null where id = c; assert false, 'revocation is final'; exception when sqlstate 'CN002' then null; end;
  begin update consents set kind = 'health_data' where id = c; assert false, 'kind is immutable'; exception when sqlstate 'CN002' then null; end;
  begin insert into consents (subject_type, subject_id, kind, version) values ('account', a, 'ai', 'x'); assert false, 'unknown kind'; exception when check_violation then null; end;

  perform set_config('ruzz.purge', 'on', true);
  delete from consents where id = c;
  get diagnostics n = row_count;
  assert n = 0, 'purge delete is turned into a detach';
  assert exists (select 1 from consents where id = c and club_id is null and organization_id is null and revoked_at is not null), 'purged consent kept, detached';
  perform set_config('ruzz.purge', '', true);

  assert not has_health_consent(a), 'no health consent yet';
  begin
    insert into body_measurements (account_id, measured_on, weight_kg) values (a, (now() at time zone 'Asia/Jakarta')::date, 60);
    assert false, 'health rows need consent';
  exception when sqlstate 'BM003' then null; end;
  insert into consents (subject_type, subject_id, kind, version) values ('account', a, 'health_data', '2026-10-20');
  assert has_health_consent(a), 'health consent active';
  insert into body_measurements (account_id, measured_on, weight_kg) values (a, (now() at time zone 'Asia/Jakarta')::date, 60), (a, (now() at time zone 'Asia/Jakarta')::date - 1, 61);

  assert withdraw_health_consent(a) = 2, 'withdraw removes all health rows';
  assert not exists (select 1 from body_measurements where account_id = a), 'health rows gone';
  assert not has_health_consent(a), 'health consent revoked';
  assert exists (select 1 from consents where subject_id = a and kind = 'health_data' and revoked_at is not null), 'health consent row kept with revoked_at';
  begin
    insert into body_measurements (account_id, measured_on, weight_kg) values (a, (now() at time zone 'Asia/Jakarta')::date, 60);
    assert false, 'no writes after withdrawal';
  exception when sqlstate 'BM003' then null; end;

  assert exists (select 1 from retention_candidates() r where r.kind = 'inactive_account' and r.ref_id = (select id from accounts where email = 'cold@t.test')), 'inactive personal account listed';
  assert not exists (select 1 from retention_candidates() r where r.ref_id = a), 'active account not listed';
end $$;

set local role authenticated;
do $$
begin
  perform pg_temp.act('ca@t.test');
  begin perform withdraw_health_consent((select current_account_id())); assert false, 'withdraw is service role only'; exception when insufficient_privilege then null; end;
  begin perform * from retention_candidates(); assert false, 'retention list is service role only'; exception when insufficient_privilege then null; end;
  begin perform has_health_consent((select current_account_id())); assert false, 'helper not callable'; exception when insufficient_privilege then null; end;
  begin
    update consents set revoked_at = now();
    assert false, 'clients cannot update consents';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
\echo consent_phase1 OK
