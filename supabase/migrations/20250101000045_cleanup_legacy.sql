create or replace function is_active_user() returns boolean as $$
  select exists (
    select 1 from profiles p
    join tenants t on t.id = p.tenant_id and t.is_active
    join accounts a on a.id = p.account_id and a.is_active
    left join organization_members o on o.id = p.owner_id
    where p.id = auth.uid()
      and p.is_active
      and p.tenant_id = current_tenant_id()
      and (p.owner_id is null or o.is_active)
      and (
        a.sessions_valid_after is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from a.sessions_valid_after))
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function activate_member_account(p_member_id uuid, p_account_id uuid)
returns table (out_account_id uuid, out_profile_id uuid, out_created boolean) as $$
declare
  v_member members%rowtype;
  v_account accounts%rowtype;
  v_profile uuid;
  v_created boolean;
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

  v_created := not exists (select 1 from profiles where account_id = v_account.id and role = 'member');

  if exists (select 1 from profiles where account_id = v_account.id and tenant_id = v_member.tenant_id) then
    raise exception using errcode = 'MP001', message = 'Email ini sudah dipakai anggota lain di klub ini';
  end if;

  insert into profiles (tenant_id, role, full_name, email, account_id)
  values (v_member.tenant_id, 'member', v_member.full_name, v_account.email, v_account.id)
  returning id into v_profile;

  update members set profile_id = v_profile where id = p_member_id;

  return query select v_account.id, v_profile, v_created;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function anonymise_member(p_member_id uuid, p_reason text, p_confirm text) returns void as $$
declare
  m members%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not has_permission('members.privacy') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if coalesce(p_confirm, '') <> 'ANONIMKAN' then
    raise exception using errcode = 'AN001', message = 'Ketik ANONIMKAN untuk mengonfirmasi';
  end if;
  if length(v_reason) < 5 then
    raise exception using errcode = 'AN002', message = 'Tulis alasan, minimal 5 karakter';
  end if;
  select * into m from members where id = p_member_id and tenant_id = current_tenant_id() for update;
  if m.id is null then
    raise exception using errcode = 'AN003', message = 'Anggota tidak ditemukan';
  end if;

  perform set_config('club27.audit_suppress', 'on', true);

  update members set
    full_name = 'Anggota anonim ' || left(id::text, 8),
    date_of_birth = date '1900-01-01',
    notes = null,
    address = null,
    contact_name = null,
    contact_phone = null,
    is_active = false,
    profile_id = null
  where id = m.id;

  if m.profile_id is not null then
    update resource_bookings set created_by = null where created_by = m.profile_id;
    delete from profiles where id = m.profile_id;
  end if;

  update bookings set notes = null where member_id = m.id;
  update orders set customer_name = null where member_id = m.id;
  update resource_bookings set guest_name = null, guest_phone = null where member_id = m.id;
  update consents set guardian_name = null where subject_type = 'member' and subject_id = m.id;

  perform set_config('club27.audit_suppress', '', true);
  perform log_audit('member.anonymise', 'member', m.id, jsonb_build_object('reason', v_reason), m.tenant_id);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function discard_unverified_registration(p_email text) returns boolean as $$
declare
  v_org uuid;
  v_tenants uuid[];
  v_account uuid;
begin
  select o.organization_id, o.account_id into v_org, v_account
  from organization_members o join organization_subscriptions s on s.organization_id = o.organization_id
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
  delete from organization_members where organization_id = v_org;
  delete from organization_subscriptions where organization_id = v_org;
  delete from organizations where id = v_org;
  if v_account is not null and not exists (select 1 from profiles where account_id = v_account) then
    delete from accounts where id = v_account and email_verified_at is null;
  end if;
  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function enforce_profile_identity() returns trigger as $$
declare
  v_owner_org uuid;
  v_owner_email text;
  v_owner_role text;
  v_tenant_org uuid;
begin
  if new.owner_id is not null then
    select organization_id, email, base_role into v_owner_org, v_owner_email, v_owner_role
    from organization_members where id = new.owner_id;
    select organization_id into v_tenant_org from tenants where id = new.tenant_id;
    if v_owner_org is distinct from v_tenant_org
       or v_owner_email is distinct from new.email
       or v_owner_role not in ('p_owner', 'owner') then
      raise exception 'owner profile must belong to a tenant of the owner organization and use the owner email';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function username_taken(p_username text, p_superadmin boolean, p_except uuid) returns boolean as $$
  select case when p_superadmin then
    exists (select 1 from superadmins where username = p_username and id is distinct from p_except)
  else
    exists (select 1 from accounts where username = p_username and id is distinct from p_except)
  end;
$$ language sql stable security definer set search_path = public;

create or replace function enforce_username() returns trigger as $$
declare
  v_superadmin boolean := tg_table_name = 'superadmins';
begin
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

create or replace function purge_organization(p_org uuid, p_execute boolean default false) returns jsonb as $$
declare
  v_name text;
  v_reason text;
  v_tenants uuid[];
  v_steps constant text[] := array[
    'order_payments:t', 'order_items:t', 'cash_ledger:t', 'orders:t', 'payroll_runs:t', 'checkins:t', 'checkin_points:t',
    'resource_bookings:t', 'bookings:t', 'classes:t', 'class_types:t', 'resource_hours:t', 'resources:t',
    'coach_certifications:t', 'invoices:t', 'subscriptions:t', 'membership_packages:t', 'promo:t', 'products:t',
    'order_counters:t', 'tenant_module_overrides:t', 'consents:to', 'audit_log:to', 'members:t',
    'organization_member_clubs:t', 'invitations:o', 'profiles:t', 'locations:t',
    'tenants:o', 'subscription_reminders:o', 'subscription_renewals:o', 'email_verifications:o',
    'organization_roles:o', 'organization_subscriptions:o', 'organization_members:o', 'organizations:id'
  ];
  v_step text;
  v_table text;
  v_scope text;
  v_cond text;
  v_count bigint;
  v_counts jsonb := '{}'::jsonb;
  r record;
begin
  select name into v_name from organizations where id = p_org;
  if v_name is null then
    raise exception using errcode = 'PG001', message = 'Organisasi tidak ditemukan';
  end if;
  if p_execute then
    if not coalesce((select enabled from platform_flags where key = 'purge_enabled'), false) then
      raise exception using errcode = 'PG002', message = 'Purge dimatikan';
    end if;
    select c.reason into v_reason from purge_candidates() c where c.organization_id = p_org;
    if v_reason is null then
      raise exception using errcode = 'PG001', message = 'Organisasi belum memenuhi syarat purge';
    end if;
  end if;

  v_tenants := array(select id from tenants where organization_id = p_org);

  if p_execute then
    perform set_config('club27.purge', 'on', true);
    update payroll_runs set cash_ledger_entry_id = null where tenant_id = any(v_tenants);
  end if;

  foreach v_step in array v_steps loop
    v_table := split_part(v_step, ':', 1);
    v_scope := split_part(v_step, ':', 2);
    v_cond := case v_scope
      when 't' then 'tenant_id = any($1)'
      when 'to' then 'tenant_id = any($1) or organization_id = $2'
      when 'o' then 'organization_id = $2'
      else 'id = $2'
    end;
    if p_execute then
      execute format('delete from %I where %s', v_table, v_cond) using v_tenants, p_org;
      get diagnostics v_count = row_count;
    else
      execute format('select count(*) from %I where %s', v_table, v_cond) into v_count using v_tenants, p_org;
    end if;
    v_counts := v_counts || jsonb_build_object(v_table, v_count);
  end loop;

  if p_execute then
    for r in
      select c.relname
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
      where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
    loop
      execute format('select count(*) from %I where tenant_id = any($1)', r.relname) into v_count using v_tenants;
      if v_count > 0 then
        raise exception using errcode = 'PG003', message = format('Data sisa di %s setelah purge', r.relname);
      end if;
    end loop;
    for r in
      select c.relname
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
      where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace and c.relname <> 'organization_purges'
    loop
      execute format('select count(*) from %I where organization_id = $1', r.relname) into v_count using p_org;
      if v_count > 0 then
        raise exception using errcode = 'PG003', message = format('Data sisa di %s setelah purge', r.relname);
      end if;
    end loop;
    insert into organization_purges (organization_id, organization_name, reason, counts)
    values (p_org, v_name, v_reason, v_counts);
  end if;

  return jsonb_build_object('dry_run', not p_execute, 'organization', v_name, 'counts', v_counts);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger profiles_enforce_identity on profiles;
drop trigger profiles_member_link on profiles;

alter table profiles
  drop constraint profiles_member_account_role,
  drop column member_account_id,
  drop column username,
  drop column must_change_password,
  drop column sessions_valid_after;

create trigger profiles_enforce_identity before insert or update of email, owner_id, tenant_id on profiles
  for each row execute function enforce_profile_identity();

create constraint trigger profiles_member_link after insert or update of role, tenant_id on profiles
  deferrable initially deferred for each row execute function check_member_profile_link();

alter table profiles add constraint profiles_member_has_account check (role <> 'member' or account_id is not null);

alter table organization_members
  drop column password_hash,
  drop column username,
  drop column failed_login_count,
  drop column locked_until,
  drop column last_login_at;

alter table organizations drop column max_tenants;

drop table auth_credentials;
drop table member_accounts;
drop table platform_subscriptions;
drop table platform_plans;

drop function enforce_member_account_email();

alter trigger org_owners_set_updated_at on organization_members rename to organization_members_set_updated_at;
alter trigger org_owners_enforce_email on organization_members rename to organization_members_enforce_email;
alter trigger org_owners_enforce_billing on organization_members rename to organization_members_enforce_billing;
alter trigger org_owners_identity_account on organization_members rename to organization_members_identity_account;
