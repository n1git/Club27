begin;

drop trigger profiles_enforce_account_link on profiles;
drop function enforce_profile_account_link();
drop trigger profiles_identity_account on profiles;
drop trigger member_accounts_identity_account on member_accounts;
drop trigger org_owners_identity_account on org_owners;
drop function enforce_identity_account();
drop trigger accounts_username on accounts;
drop trigger accounts_enforce_email on accounts;
drop function enforce_account_email();

drop function register_organization_unverified(text, text, uuid, text, text, text, text);
drop function register_organization(text, text, uuid, text, text, text);
drop function verify_registration(text);
drop function create_tenant_for_owner(uuid, text, text);
drop function activate_member_account(uuid, uuid);

CREATE OR REPLACE FUNCTION public.register_organization(p_organization_name text, p_tenant_name text, p_owner_name text, p_owner_email text, p_password_hash text, p_plan text, p_period text, p_club_type text DEFAULT 'swimming'::text, p_username text DEFAULT NULL::text)
 RETURNS TABLE(organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.register_organization_unverified(p_organization_name text, p_tenant_name text, p_owner_name text, p_owner_email text, p_password_hash text, p_plan text, p_period text, p_club_type text, p_token_hash text, p_username text DEFAULT NULL::text)
 RETURNS TABLE(organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.verify_registration(p_token_hash text)
 RETURNS TABLE(organization_id uuid, tenant_id uuid, profile_id uuid, email text, full_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  return query
  select t.organization_id, p.tenant_id, p.id, p.email, p.full_name
  from profiles p join tenants t on t.id = p.tenant_id
  where p.owner_id = v.owner_id
  order by t.created_at
  limit 1;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.discard_unverified_registration(p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_tenants uuid[];
begin
  select o.organization_id into v_org
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
  return true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_tenant_for_owner(p_owner_id uuid, p_tenant_name text, p_club_type text DEFAULT 'swimming'::text)
 RETURNS TABLE(tenant_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner org_owners%rowtype;
  v_tenant uuid;
  v_profile uuid;
begin
  select * into v_owner from org_owners where id = p_owner_id and is_active;
  if v_owner.id is null then
    raise exception 'owner not found';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', v_owner.full_name, v_owner.email, v_owner.id) returning id into v_profile;

  return query select v_tenant, v_profile;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.activate_member_account(p_member_id uuid, p_email text, p_password_hash text, p_username text DEFAULT NULL::text)
 RETURNS TABLE(out_account_id uuid, out_profile_id uuid, out_created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.username_taken(p_username text, p_superadmin boolean, p_except uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_superadmin then
    exists (select 1 from superadmins where username = p_username and id is distinct from p_except)
  else
    exists (select 1 from org_owners where username = p_username and id is distinct from p_except)
    or exists (select 1 from member_accounts where username = p_username and id is distinct from p_except)
    or exists (select 1 from profiles where username = p_username and owner_id is null and member_account_id is null and id is distinct from p_except)
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_active_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from profiles p
    join tenants t on t.id = p.tenant_id and t.is_active
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
  );
$function$
;

revoke execute on function register_organization(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function register_organization_unverified(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function verify_registration(text) from public, anon, authenticated;
revoke execute on function discard_unverified_registration(text) from public, anon, authenticated;
revoke execute on function create_tenant_for_owner(uuid, text, text) from public, anon, authenticated;
revoke execute on function activate_member_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function register_organization(text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function register_organization_unverified(text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function verify_registration(text) to service_role;
grant execute on function discard_unverified_registration(text) to service_role;
grant execute on function create_tenant_for_owner(uuid, text, text) to service_role;
grant execute on function activate_member_account(uuid, text, text, text) to service_role;

alter table consents drop constraint consents_subject_type_check;
alter table consents add constraint consents_subject_type_check check (subject_type in ('owner', 'member'));

create trigger org_owners_username before insert or update of username on org_owners
  for each row execute function enforce_username();
create trigger member_accounts_username before insert or update of username on member_accounts
  for each row execute function enforce_username();
create trigger profiles_username before insert or update of username, owner_id, member_account_id on profiles
  for each row execute function enforce_username();

do $$
begin
  if exists (select 1 from org_owners where password_hash is null or username is null)
     or exists (select 1 from member_accounts where password_hash is null or username is null)
     or exists (select 1 from auth_credentials where password_hash is null) then
    raise exception 'legacy identity rows have no credentials; restore them from the pg_dump taken before the migration first';
  end if;
end $$;

alter table org_owners alter column password_hash set not null;
alter table org_owners alter column username set not null;
alter table member_accounts alter column password_hash set not null;
alter table member_accounts alter column username set not null;
alter table auth_credentials alter column password_hash set not null;
alter table profiles add constraint profiles_username_scope
  check ((owner_id is null and member_account_id is null) = (username is not null));

drop index profiles_account_idx;
drop index profiles_account_tenant_idx;
alter table profiles drop column account_id;
alter table member_accounts drop column account_id;
alter table org_owners drop column account_id;
drop table accounts;

commit;
