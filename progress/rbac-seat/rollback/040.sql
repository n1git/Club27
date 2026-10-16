begin;

drop trigger organization_member_clubs_enforce on organization_member_clubs;
drop function enforce_member_club_assignment();
drop table organization_member_clubs;
drop trigger organization_members_one_p_owner on organization_members;
drop function check_one_p_owner();
drop index organization_members_one_p_owner_idx;
drop index organization_members_org_account_idx;
drop index organization_members_email_idx;

do $$
begin
  if exists (select 1 from organization_members where base_role = 'staff')
     or exists (select account_id from organization_members group by account_id having count(*) > 1)
     or exists (select email from organization_members group by email having count(*) > 1) then
    raise exception 'staff members, multi-organization accounts or repeated emails exist; resolve them before rolling back';
  end if;
end $$;

alter table organization_members drop column base_role;
alter table organization_members add constraint org_owners_email_key unique (email);
alter table organization_members add constraint org_owners_account_id_key unique (account_id);
alter table organization_members rename to org_owners;

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
  if v_owner.id is null or v_owner.account_id is null then
    raise exception 'owner not found';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
  values (v_tenant, 'admin', v_owner.full_name, v_owner.email, v_owner.id, v_owner.account_id) returning id into v_profile;

  return query select v_tenant, v_profile;
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
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_member_account_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.email <> old.email then
    raise exception 'member account email cannot be changed';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.email));
  if exists (select 1 from org_owners where email = new.email)
     or exists (select 1 from profiles where email = new.email and member_account_id is null) then
    raise exception using errcode = '23505', message = 'Email sudah terdaftar';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_profile_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_org uuid;
  v_owner_email text;
  v_tenant_org uuid;
  v_account_email text;
begin
  perform pg_advisory_xact_lock(hashtext(new.email));
  if new.member_account_id is not null then
    select email into v_account_email from member_accounts where id = new.member_account_id;
    if v_account_email is distinct from new.email then
      raise exception 'member profile must use the account email';
    end if;
  elsif new.owner_id is null then
    if exists (select 1 from org_owners where email = new.email)
       or exists (select 1 from member_accounts where email = new.email) then
      raise exception using errcode = '23505', message = 'Email sudah terdaftar';
    end if;
  else
    select organization_id, email into v_owner_org, v_owner_email from org_owners where id = new.owner_id;
    select organization_id into v_tenant_org from tenants where id = new.tenant_id;
    if v_owner_org is distinct from v_tenant_org or v_owner_email is distinct from new.email then
      raise exception 'owner profile must belong to a tenant of the owner organization and use the owner email';
    end if;
  end if;
  return new;
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
$function$
;
CREATE OR REPLACE FUNCTION public.organization_internal_users(p_org uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (
    (select count(*) from org_owners where organization_id = p_org and is_active)
    + (
      select count(*) from profiles p
      join tenants t on t.id = p.tenant_id
      where t.organization_id = p_org
        and p.owner_id is null
        and p.role in ('admin', 'coach', 'receptionist', 'finance')
        and p.is_active
    )
  )::int;
$function$
;
CREATE OR REPLACE FUNCTION public.register_organization(p_organization_name text, p_tenant_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text DEFAULT 'swimming'::text)
 RETURNS TABLE(organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    exists (select 1 from accounts where username = p_username and id is distinct from p_except)
    or exists (select 1 from org_owners where username = p_username and id is distinct from p_except)
    or exists (select 1 from member_accounts where username = p_username and id is distinct from p_except)
    or exists (select 1 from profiles where username = p_username and owner_id is null and member_account_id is null and id is distinct from p_except)
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.verify_registration(p_token_hash text)
 RETURNS TABLE(organization_id uuid, tenant_id uuid, profile_id uuid, account_id uuid, email text, full_name text)
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

  update accounts set email_verified_at = now()
  where id = (select o.account_id from org_owners o where o.id = v.owner_id) and email_verified_at is null;

  return query
  select t.organization_id, p.tenant_id, p.id, p.account_id, p.email, p.full_name
  from profiles p join tenants t on t.id = p.tenant_id
  where p.owner_id = v.owner_id
  order by t.created_at
  limit 1;
end;
$function$
;

commit;
