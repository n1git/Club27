\set ON_ERROR_STOP on
begin;

create function pg_temp.claims(p_sub uuid, p_tenant text, p_role text, p_account uuid, p_iat bigint default null) returns void language sql as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_sub, 'role', 'authenticated', 'app_role', p_role, 'tenant_id', p_tenant, 'org_id', '',
    'account_id', p_account, 'iat', coalesce(p_iat, extract(epoch from now())::bigint)
  )::text, true)
$f$;
grant execute on function pg_temp.claims(uuid, text, text, uuid, bigint) to public;

insert into accounts (email, full_name, password_hash) values
  ('owner@t.test', 'Owner One', 'h'), ('owner2@t.test', 'Owner Two', 'h'),
  ('member@t.test', 'Member One', 'h'), ('plain@t.test', 'Plain One', 'h') ;

do $$
declare
  a uuid; r record; r2 record; v_member uuid; v_profile uuid;
begin
  assert (select count(*) from accounts where username is not null) = 4, 'usernames generated';
  assert (select count(distinct username) from accounts) = 4, 'usernames unique';

  begin
    insert into accounts (email, full_name, password_hash, username) values ('OWNER@t.test', 'x', 'h', 'zzz');
    assert false, 'uppercase email must fail';
  exception when check_violation then null; end;

  begin
    insert into accounts (email, full_name, password_hash) values ('owner@t.test', 'x', 'h');
    assert false, 'duplicate email must fail';
  exception when unique_violation then null; end;

  begin
    update accounts set email = 'other@t.test' where email = 'plain@t.test';
    assert false, 'email change must fail';
  exception when raise_exception then null; end;

  begin
    insert into accounts (email, full_name, password_hash, username) values ('u@t.test', 'x', 'h', (select username from accounts limit 1));
    assert false, 'duplicate username must fail';
  exception when unique_violation then null; end;

  select id into a from accounts where email = 'owner@t.test';
  select * into r from register_organization('Org A', 'Club A', a, 'standard', 'monthly', 'swimming');
  assert (select account_id from organization_members where id = r.owner_id) = a, 'owner linked to account';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and column_name = 'password_hash' and table_name <> all (array['accounts', 'superadmins'])), 'passwords live only in accounts and superadmins';
  assert (select account_id from profiles where id = r.profile_id) = a, 'owner profile linked to account';

  select id into a from accounts where email = 'owner2@t.test';
  select * into r2 from register_organization('Org C', 'Club C', a, 'standard', 'monthly', 'gym');

  begin
    insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
    values (r.tenant_id, 'staff', (select id from organization_roles where organization_id = r.organization_id and preset_key = 'pelatih'), 'C', 'someone@t.test', (select id from accounts where email = 'plain@t.test'));
    assert false, 'profile email must match account email';
  exception when raise_exception then null; end;

  insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
  values (r.tenant_id, 'staff', (select id from organization_roles where organization_id = r.organization_id and preset_key = 'pelatih'), 'Plain', 'plain@t.test', (select id from accounts where email = 'plain@t.test'));

  insert into members (tenant_id, full_name, date_of_birth) values (r.tenant_id, 'Member One', '2010-01-01') returning id into v_member;
  select out_profile_id into v_profile from activate_member_account(v_member, (select id from accounts where email = 'member@t.test'));
  assert (select account_id from profiles where id = v_profile) = (select id from accounts where email = 'member@t.test'), 'member profile linked to account';

  insert into members (tenant_id, full_name, date_of_birth) values (r2.tenant_id, 'Member One', '2010-01-01') returning id into v_member;
  perform activate_member_account(v_member, (select id from accounts where email = 'member@t.test'));
  assert (select count(*) from profiles where account_id = (select id from accounts where email = 'member@t.test')) = 2, 'same account is a member in two clubs';
  assert (select count(*) from profiles where role = 'member' and account_id = (select id from accounts where email = 'member@t.test')) = 2, 'member profiles are plain club profiles of the account';

  insert into members (tenant_id, full_name, date_of_birth) values (r.tenant_id, 'Owner As Member', '2010-01-01') returning id into v_member;
  begin
    perform activate_member_account(v_member, (select id from accounts where email = 'owner@t.test'));
    assert false, 'an account already linked to the club cannot be activated as member there';
  exception when sqlstate 'MP001' then null; end;
end $$;

do $$
declare
  p uuid; t uuid; a uuid; o uuid;
begin
  select id, tenant_id, account_id into p, t, a from profiles where owner_id is not null and email = 'owner@t.test';
  perform pg_temp.claims(p, t::text, 'owner', a);
  assert is_active_user(), 'active owner';
  perform pg_temp.claims(p, t::text, 'owner', a, extract(epoch from now())::bigint - 3600);
  update accounts set sessions_valid_after = now() - interval '10 minutes' where id = a;
  assert not is_active_user(), 'token older than account revocation is rejected';
  perform pg_temp.claims(p, t::text, 'owner', a);
  assert is_active_user(), 'fresh token passes after revocation';
  update accounts set is_active = false where id = a;
  assert not is_active_user(), 'inactive account is rejected';
  update accounts set is_active = true where id = a;
  perform set_config('request.jwt.claims', '', true);
  update profiles set account_id = null where id = p;
  perform pg_temp.claims(p, t::text, 'owner', a);
  assert not is_active_user(), 'profile without account is rejected';
  perform set_config('request.jwt.claims', '', true);
  update profiles set account_id = a where id = p;
  perform pg_temp.claims(p, t::text, 'owner', a);
  assert is_active_user(), 'restored';
end $$;

select set_config('t.plain', (select id::text from accounts where email = 'plain@t.test'), false),
       set_config('t.owner_profile', (select id::text from profiles where owner_id is not null and email = 'owner@t.test'), false),
       set_config('t.owner_tenant', (select tenant_id::text from profiles where owner_id is not null and email = 'owner@t.test'), false),
       set_config('t.owner_account', (select account_id::text from profiles where owner_id is not null and email = 'owner@t.test'), false);

create temp table iso_objects as
select c.relname::text as name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (
    (c.relkind = 'r' and c.relrowsecurity
      and c.relname not in ('subscription_plans', 'platform_modules', 'club_types', 'club_type_modules', 'club_type_presets'))
    or (c.relkind = 'v' and not coalesce('security_invoker=true' = any (c.reloptions), false))
  )
  and has_table_privilege('authenticated', c.oid, 'select');
grant select on iso_objects to public;

set local role authenticated;

do $$
declare
  a uuid; n int; o record; total int := 0; seen int := 0;
begin
  a := current_setting('t.plain')::uuid;
  perform pg_temp.claims(a, '', 'personal', a);
  for o in select * from iso_objects loop
    execute format('select count(*) from %I', o.name) into n;
    total := total + n;
    seen := seen + 1;
    assert n = 0, format('personal context reads %s rows from %s', n, o.name);
  end loop;
  assert seen > 20, 'isolation loop covers the schema';
end $$;

do $$
declare
  p uuid; t uuid; a uuid; n int;
begin
  p := current_setting('t.owner_profile')::uuid;
  t := current_setting('t.owner_tenant')::uuid;
  a := current_setting('t.owner_account')::uuid;
  perform pg_temp.claims(p, t::text, 'owner', a);
  select count(*) into n from tenants;
  assert n = 1, 'owner sees only its own club';
  begin
    update profiles set account_id = current_setting('t.plain')::uuid where id = p;
    assert false, 'a club user cannot relink a profile to another account';
  exception when raise_exception then null; end;
  begin
    insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
    values (t, 'staff', gen_random_uuid(), 'X', 'plain@t.test', current_setting('t.plain')::uuid);
    assert false, 'a club user cannot insert a profile with an account link';
  exception when raise_exception then null; end;
  begin
    perform 1 from accounts;
    assert false, 'accounts must not be readable by club users';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  a uuid; token text := 'tok-' || gen_random_uuid()::text; r record; c int;
begin
  insert into accounts (email, full_name, password_hash) values ('unv@t.test', 'Unverified', 'h') returning id into a;
  select * into r from register_organization_unverified('Org U', 'Club U', a, 'standard', 'monthly', 'swimming', token);
  assert (select email_verified_at from accounts where id = a) is null, 'unverified until the link is used';
  assert discard_unverified_registration('unv@t.test'), 'unverified registration discarded';
  assert not exists (select 1 from accounts where id = a), 'unverified account removed with the registration';

  insert into accounts (email, full_name, password_hash) values ('unv2@t.test', 'Unverified Two', 'h') returning id into a;
  perform register_organization_unverified('Org V', 'Club V', a, 'standard', 'monthly', 'swimming', 'tok2-' || gen_random_uuid()::text);
  select * into r from verify_registration((select token_hash from email_verifications order by created_at desc limit 1));
  assert r.account_id = a, 'verification returns the account';
  assert (select email_verified_at from accounts where id = a) is not null, 'verification stamps the account';
end $$;

rollback;
