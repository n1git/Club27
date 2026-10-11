alter table org_owners add column username text check (username ~ '^[a-z][a-z0-9._]{2,29}$');
alter table member_accounts add column username text check (username ~ '^[a-z][a-z0-9._]{2,29}$');
alter table profiles add column username text check (username ~ '^[a-z][a-z0-9._]{2,29}$');
alter table superadmins add column username text check (username ~ '^[a-z][a-z0-9._]{2,29}$');

create unique index org_owners_username_idx on org_owners(username);
create unique index member_accounts_username_idx on member_accounts(username);
create unique index profiles_username_idx on profiles(username) where owner_id is null and member_account_id is null;
create unique index superadmins_username_idx on superadmins(username);

create function username_reserved(p_username text) returns boolean as $$
  select p_username in ('admin', 'superadmin', 'support', 'root', 'system', 'club27');
$$ language sql immutable set search_path = public;

create function username_taken(p_username text, p_superadmin boolean, p_except uuid) returns boolean as $$
  select case when p_superadmin then
    exists (select 1 from superadmins where username = p_username and id is distinct from p_except)
  else
    exists (select 1 from org_owners where username = p_username and id is distinct from p_except)
    or exists (select 1 from member_accounts where username = p_username and id is distinct from p_except)
    or exists (select 1 from profiles where username = p_username and owner_id is null and member_account_id is null and id is distinct from p_except)
  end;
$$ language sql stable security definer set search_path = public;

create function suggest_username(p_email text, p_superadmin boolean default false) returns text as $$
declare
  v_base text := regexp_replace(lower(split_part(coalesce(p_email, ''), '@', 1)), '[^a-z0-9._]', '', 'g');
  v_candidate text;
  v_n int := 1;
begin
  if v_base !~ '^[a-z]' then
    v_base := 'u' || v_base;
  end if;
  v_base := left(v_base, 30);
  if length(v_base) < 3 then
    v_base := rpad(v_base, 3, '0');
  end if;
  v_candidate := v_base;
  while (not p_superadmin and username_reserved(v_candidate)) or username_taken(v_candidate, p_superadmin, null) loop
    v_n := v_n + 1;
    v_candidate := left(v_base, 30 - length(v_n::text)) || v_n;
  end loop;
  return v_candidate;
end;
$$ language plpgsql stable security definer set search_path = public;

create function enforce_username() returns trigger as $$
declare
  v_superadmin boolean := tg_table_name = 'superadmins';
begin
  if tg_table_name = 'profiles' and (to_jsonb(new) ->> 'owner_id' is not null or to_jsonb(new) ->> 'member_account_id' is not null) then
    new.username := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;
  end if;
  if new.username is null then
    loop
      new.username := suggest_username(new.email, v_superadmin);
      perform pg_advisory_xact_lock(hashtext('u:' || new.username));
      exit when not username_taken(new.username, v_superadmin, new.id);
    end loop;
    return new;
  end if;
  new.username := lower(trim(new.username));
  if not v_superadmin and username_reserved(new.username) then
    raise exception using errcode = '23514', message = 'Username tidak tersedia';
  end if;
  perform pg_advisory_xact_lock(hashtext('u:' || new.username));
  if username_taken(new.username, v_superadmin, new.id) then
    raise exception using errcode = '23505', message = 'Username sudah dipakai';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function username_taken(text, boolean, uuid) from public, anon, authenticated;
revoke execute on function suggest_username(text, boolean) from public, anon, authenticated;
revoke execute on function enforce_username() from public, anon, authenticated;
grant execute on function suggest_username(text, boolean) to service_role;

do $$
declare
  r record;
begin
  for r in
    select 'org_owners' as t, id, created_at from org_owners
    union all select 'profiles', id, created_at from profiles where owner_id is null and member_account_id is null
    union all select 'member_accounts', id, created_at from member_accounts
    order by created_at, id
  loop
    if r.t = 'org_owners' then
      update org_owners set username = suggest_username(email) where id = r.id;
    elsif r.t = 'profiles' then
      update profiles set username = suggest_username(email) where id = r.id;
    else
      update member_accounts set username = suggest_username(email) where id = r.id;
    end if;
  end loop;
  for r in select id from superadmins order by created_at, id loop
    update superadmins set username = suggest_username(email, true) where id = r.id;
  end loop;
end $$;

alter table org_owners alter column username set not null;
alter table member_accounts alter column username set not null;
alter table superadmins alter column username set not null;
alter table profiles add constraint profiles_username_scope
  check ((owner_id is null and member_account_id is null) = (username is not null));

create trigger org_owners_username before insert or update of username on org_owners
  for each row execute function enforce_username();
create trigger member_accounts_username before insert or update of username on member_accounts
  for each row execute function enforce_username();
create trigger profiles_username before insert or update of username, owner_id, member_account_id on profiles
  for each row execute function enforce_username();
create trigger superadmins_username before insert or update of username on superadmins
  for each row execute function enforce_username();

drop function register_organization_unverified(text, text, text, text, text, text, text, text, text);
drop function register_organization(text, text, text, text, text, text, text, text);

create function register_organization(
  p_organization_name text,
  p_tenant_name text,
  p_owner_name text,
  p_owner_email text,
  p_password_hash text,
  p_plan text,
  p_period text,
  p_club_type text default 'swimming',
  p_username text default null
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  v_org uuid;
  v_tenant uuid;
  v_owner uuid;
  v_profile uuid;
  v_trial_days int;
  v_email text := lower(trim(p_owner_email));
begin
  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'invalid billing period';
  end if;
  select trial_days into v_trial_days from subscription_plans where code = p_plan and is_active;
  if not found then
    raise exception 'plan not available';
  end if;

  insert into organizations (name) values (p_organization_name) returning id into v_org;

  insert into organization_subscriptions (organization_id, plan_code, billing_period, status, trial_ends_at)
  values (
    v_org,
    p_plan,
    p_period,
    case when v_trial_days > 0 then 'trial' else 'pending' end,
    case when v_trial_days > 0 then (now() at time zone 'Asia/Jakarta')::date + v_trial_days end
  );

  insert into org_owners (organization_id, email, full_name, password_hash, username)
  values (v_org, v_email, p_owner_name, p_password_hash, nullif(lower(trim(p_username)), '')) returning id into v_owner;

  v_tenant := create_tenant_row(v_org, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', p_owner_name, v_email, v_owner) returning id into v_profile;

  return query select v_org, v_tenant, v_owner, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

create function register_organization_unverified(
  p_organization_name text,
  p_tenant_name text,
  p_owner_name text,
  p_owner_email text,
  p_password_hash text,
  p_plan text,
  p_period text,
  p_club_type text,
  p_token_hash text,
  p_username text default null
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  r record;
begin
  select * into r from register_organization(
    p_organization_name, p_tenant_name, p_owner_name, p_owner_email, p_password_hash, p_plan, p_period, p_club_type, p_username
  );
  update organization_subscriptions set status = 'pending_verification', trial_ends_at = null
  where organization_subscriptions.organization_id = r.organization_id;
  insert into email_verifications (organization_id, owner_id, token_hash, expires_at)
  values (r.organization_id, r.owner_id, p_token_hash, now() + interval '24 hours');
  return query select r.organization_id, r.tenant_id, r.owner_id, r.profile_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function register_organization(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function register_organization_unverified(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function register_organization(text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function register_organization_unverified(text, text, text, text, text, text, text, text, text, text) to service_role;

drop function activate_member_account(uuid, text, text);

create function activate_member_account(p_member_id uuid, p_email text, p_password_hash text, p_username text default null)
returns table (out_account_id uuid, out_profile_id uuid, out_created boolean) as $$
declare
  v_member members%rowtype;
  v_email text := lower(trim(p_email));
  v_account uuid;
  v_profile uuid;
  v_created boolean := false;
begin
  select * into v_member from members where id = p_member_id for update;
  if v_member.id is null then
    raise exception 'member not found';
  end if;
  if not club_has_module(v_member.tenant_id, 'member_portal') then
    raise exception using errcode = 'MP003', message = 'Modul portal anggota belum tersedia';
  end if;
  if not v_member.is_active then
    raise exception using errcode = 'MP004', message = 'Anggota nonaktif tidak dapat diaktifkan';
  end if;
  if v_member.profile_id is not null then
    raise exception using errcode = 'MP002', message = 'Akun anggota ini sudah diaktifkan';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_email));

  select id into v_account from member_accounts where email = v_email;
  if v_account is null then
    insert into member_accounts (email, full_name, password_hash, must_change_password, username)
    values (v_email, v_member.full_name, p_password_hash, true, nullif(lower(trim(p_username)), ''))
    returning id into v_account;
    v_created := true;
  end if;

  if exists (select 1 from profiles where member_account_id = v_account and tenant_id = v_member.tenant_id) then
    raise exception using errcode = 'MP001', message = 'Email ini sudah dipakai anggota lain di klub ini';
  end if;

  insert into profiles (tenant_id, role, full_name, email, member_account_id)
  values (v_member.tenant_id, 'member', v_member.full_name, v_email, v_account)
  returning id into v_profile;

  update members set profile_id = v_profile where id = p_member_id;

  return query select v_account, v_profile, v_created;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function activate_member_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function activate_member_account(uuid, text, text, text) to service_role;
