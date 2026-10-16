create table accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  username text not null check (username ~ '^[a-z][a-z0-9._]{2,29}$'),
  full_name text not null check (char_length(full_name) between 1 and 200),
  password_hash text not null,
  must_change_password boolean not null default false,
  is_active boolean not null default true,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  email_verified_at timestamptz,
  sessions_valid_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index accounts_email_idx on accounts(email);
create unique index accounts_username_idx on accounts(username);

create trigger accounts_set_updated_at before update on accounts
  for each row execute function set_updated_at();

alter table accounts enable row level security;
revoke all on accounts from anon, authenticated;

alter table org_owners add column account_id uuid unique references accounts(id);
alter table member_accounts add column account_id uuid unique references accounts(id);
alter table profiles add column account_id uuid references accounts(id);
create unique index profiles_account_tenant_idx on profiles(account_id, tenant_id) where account_id is not null;
create index profiles_account_idx on profiles(account_id) where account_id is not null;

alter table org_owners alter column password_hash drop not null;
alter table org_owners alter column username drop not null;
alter table member_accounts alter column password_hash drop not null;
alter table member_accounts alter column username drop not null;
alter table auth_credentials alter column password_hash drop not null;
alter table profiles drop constraint profiles_username_scope;

drop trigger org_owners_username on org_owners;
drop trigger member_accounts_username on member_accounts;
drop trigger profiles_username on profiles;

create or replace function username_taken(p_username text, p_superadmin boolean, p_except uuid) returns boolean as $$
  select case when p_superadmin then
    exists (select 1 from superadmins where username = p_username and id is distinct from p_except)
  else
    exists (select 1 from accounts where username = p_username and id is distinct from p_except)
    or exists (select 1 from org_owners where username = p_username and id is distinct from p_except)
    or exists (select 1 from member_accounts where username = p_username and id is distinct from p_except)
    or exists (select 1 from profiles where username = p_username and owner_id is null and member_account_id is null and id is distinct from p_except)
  end;
$$ language sql stable security definer set search_path = public;

create trigger accounts_username before insert or update of username on accounts
  for each row execute function enforce_username();

create function enforce_account_email() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.email <> old.email then
    raise exception 'account email cannot be changed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger accounts_enforce_email before insert or update of email on accounts
  for each row execute function enforce_account_email();

create function enforce_identity_account() returns trigger as $$
declare
  v_email text;
begin
  if new.account_id is null then
    return new;
  end if;
  select email into v_email from accounts where id = new.account_id;
  if v_email is distinct from new.email then
    raise exception 'identity must use the account email';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_identity_account() from public, anon, authenticated;

create trigger org_owners_identity_account before insert or update of account_id, email on org_owners
  for each row execute function enforce_identity_account();
create trigger member_accounts_identity_account before insert or update of account_id, email on member_accounts
  for each row execute function enforce_identity_account();
create trigger profiles_identity_account before insert or update of account_id, email on profiles
  for each row execute function enforce_identity_account();

create or replace function is_active_user() returns boolean as $$
  select exists (
    select 1 from profiles p
    join tenants t on t.id = p.tenant_id and t.is_active
    join accounts a on a.id = p.account_id and a.is_active
    left join org_owners o on o.id = p.owner_id
    left join member_accounts ma on ma.id = p.member_account_id
    where p.id = auth.uid()
      and p.is_active
      and p.tenant_id = current_tenant_id()
      and (p.owner_id is null or o.is_active)
      and (p.member_account_id is null or ma.is_active)
      and (
        p.sessions_valid_after is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from p.sessions_valid_after))
      )
      and (
        a.sessions_valid_after is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from a.sessions_valid_after))
      )
  );
$$ language sql stable security definer set search_path = public;

drop function register_organization_unverified(text, text, text, text, text, text, text, text, text, text);
drop function register_organization(text, text, text, text, text, text, text, text, text);

create function register_organization(
  p_organization_name text,
  p_tenant_name text,
  p_account_id uuid,
  p_plan text,
  p_period text,
  p_club_type text default 'swimming'
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  v_account accounts%rowtype;
  v_org uuid;
  v_tenant uuid;
  v_owner uuid;
  v_profile uuid;
  v_trial_days int;
begin
  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'invalid billing period';
  end if;
  select trial_days into v_trial_days from subscription_plans where code = p_plan and is_active;
  if not found then
    raise exception 'plan not available';
  end if;
  select * into v_account from accounts where id = p_account_id and is_active;
  if v_account.id is null then
    raise exception 'account not found';
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

  insert into org_owners (organization_id, account_id, email, full_name)
  values (v_org, v_account.id, v_account.email, v_account.full_name) returning id into v_owner;

  v_tenant := create_tenant_row(v_org, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
  values (v_tenant, 'admin', v_account.full_name, v_account.email, v_owner, v_account.id) returning id into v_profile;

  return query select v_org, v_tenant, v_owner, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

create function register_organization_unverified(
  p_organization_name text,
  p_tenant_name text,
  p_account_id uuid,
  p_plan text,
  p_period text,
  p_club_type text,
  p_token_hash text
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  r record;
begin
  select * into r from register_organization(
    p_organization_name, p_tenant_name, p_account_id, p_plan, p_period, p_club_type
  );
  update organization_subscriptions set status = 'pending_verification', trial_ends_at = null
  where organization_subscriptions.organization_id = r.organization_id;
  insert into email_verifications (organization_id, owner_id, token_hash, expires_at)
  values (r.organization_id, r.owner_id, p_token_hash, now() + interval '24 hours');
  return query select r.organization_id, r.tenant_id, r.owner_id, r.profile_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function register_organization(text, text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function register_organization_unverified(text, text, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function register_organization(text, text, uuid, text, text, text) to service_role;
grant execute on function register_organization_unverified(text, text, uuid, text, text, text, text) to service_role;

drop function verify_registration(text);

create function verify_registration(p_token_hash text)
returns table (organization_id uuid, tenant_id uuid, profile_id uuid, account_id uuid, email text, full_name text) as $$
declare
  v record;
  v_trial_days int;
begin
  select ev.* into v from email_verifications ev
  where ev.token_hash = p_token_hash and ev.used_at is null and ev.expires_at > now()
  for update;
  if v.id is null then
    return;
  end if;
  update email_verifications set used_at = now() where id = v.id;

  select sp.trial_days into v_trial_days
  from organization_subscriptions os join subscription_plans sp on sp.code = os.plan_code
  where os.organization_id = v.organization_id;

  update organization_subscriptions set
    status = case when coalesce(v_trial_days, 0) > 0 then 'trial' else 'pending' end,
    trial_ends_at = case when coalesce(v_trial_days, 0) > 0 then (now() at time zone 'Asia/Jakarta')::date + v_trial_days end
  where organization_subscriptions.organization_id = v.organization_id and status = 'pending_verification';

  update accounts set email_verified_at = now()
  where id = (select o.account_id from org_owners o where o.id = v.owner_id) and email_verified_at is null;

  return query
  select t.organization_id, p.tenant_id, p.id, p.account_id, p.email, p.full_name
  from profiles p join tenants t on t.id = p.tenant_id
  where p.owner_id = v.owner_id
  order by t.created_at
  limit 1;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function verify_registration(text) from public, anon, authenticated;
grant execute on function verify_registration(text) to service_role;

create or replace function discard_unverified_registration(p_email text) returns boolean as $$
declare
  v_org uuid;
  v_tenants uuid[];
  v_account uuid;
begin
  select o.organization_id, o.account_id into v_org, v_account
  from org_owners o join organization_subscriptions s on s.organization_id = o.organization_id
  where o.email = lower(trim(p_email)) and s.status = 'pending_verification';
  if v_org is null then
    return false;
  end if;
  select array_agg(id) into v_tenants from tenants where organization_id = v_org;
  if exists (select 1 from profiles where tenant_id = any(v_tenants) and owner_id is null)
     or exists (select 1 from members where tenant_id = any(v_tenants))
     or (select count(*) from tenants where organization_id = v_org) > 1 then
    raise exception 'registration already has data';
  end if;
  delete from email_verifications where organization_id = v_org;
  delete from profiles where tenant_id = any(v_tenants);
  delete from tenants where organization_id = v_org;
  delete from org_owners where organization_id = v_org;
  delete from organization_subscriptions where organization_id = v_org;
  delete from organizations where id = v_org;
  if v_account is not null and not exists (select 1 from profiles where account_id = v_account)
     and not exists (select 1 from member_accounts where account_id = v_account) then
    delete from accounts where id = v_account and email_verified_at is null;
  end if;
  return true;
end;
$$ language plpgsql security definer set search_path = public;

drop function create_tenant_for_owner(uuid, text, text);

create function create_tenant_for_owner(p_owner_id uuid, p_tenant_name text, p_club_type text default 'swimming')
returns table (tenant_id uuid, profile_id uuid) as $$
declare
  v_owner org_owners%rowtype;
  v_tenant uuid;
  v_profile uuid;
begin
  select * into v_owner from org_owners where id = p_owner_id and is_active;
  if v_owner.id is null or v_owner.account_id is null then
    raise exception 'owner not found';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
  values (v_tenant, 'admin', v_owner.full_name, v_owner.email, v_owner.id, v_owner.account_id) returning id into v_profile;

  return query select v_tenant, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_tenant_for_owner(uuid, text, text) from public, anon, authenticated;
grant execute on function create_tenant_for_owner(uuid, text, text) to service_role;

drop function activate_member_account(uuid, text, text, text);

create function activate_member_account(p_member_id uuid, p_account_id uuid)
returns table (out_account_id uuid, out_profile_id uuid, out_created boolean) as $$
declare
  v_member members%rowtype;
  v_account accounts%rowtype;
  v_member_account uuid;
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

  select * into v_account from accounts where id = p_account_id and is_active;
  if v_account.id is null then
    raise exception 'account not found';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_account.email));

  select id into v_member_account from member_accounts where account_id = v_account.id;
  if v_member_account is null then
    insert into member_accounts (account_id, email, full_name, must_change_password)
    values (v_account.id, v_account.email, v_account.full_name, false)
    returning id into v_member_account;
    v_created := true;
  end if;

  if exists (select 1 from profiles where member_account_id = v_member_account and tenant_id = v_member.tenant_id) then
    raise exception using errcode = 'MP001', message = 'Email ini sudah dipakai anggota lain di klub ini';
  end if;

  insert into profiles (tenant_id, role, full_name, email, member_account_id, account_id)
  values (v_member.tenant_id, 'member', v_member.full_name, v_account.email, v_member_account, v_account.id)
  returning id into v_profile;

  update members set profile_id = v_profile where id = p_member_id;

  return query select v_member_account, v_profile, v_created;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function activate_member_account(uuid, uuid) from public, anon, authenticated;
grant execute on function activate_member_account(uuid, uuid) to service_role;

alter table consents drop constraint consents_subject_type_check;
alter table consents add constraint consents_subject_type_check
  check (subject_type in ('owner', 'member', 'account'));

create function enforce_profile_account_link() returns trigger as $$
begin
  if current_app_role() <> ''
     and new.account_id is not null
     and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then
    raise exception 'account link cannot be changed';
  end if;
  if tg_op = 'UPDATE' and old.account_id is not null and new.account_id is null and current_app_role() <> '' then
    raise exception 'account link cannot be changed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger profiles_enforce_account_link before insert or update of account_id on profiles
  for each row execute function enforce_profile_account_link();
