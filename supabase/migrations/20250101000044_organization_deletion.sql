alter table organizations
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references accounts(id) on delete set null,
  add column purge_after timestamptz,
  add column deletion_previous_status text,
  add constraint organizations_deletion_pair_check check ((deletion_requested_at is null) = (purge_after is null));

create table platform_flags (
  key text primary key,
  enabled boolean not null default false
);

insert into platform_flags (key, enabled) values ('purge_enabled', false);

alter table platform_flags enable row level security;
revoke all on platform_flags from anon, authenticated;

create table organization_purges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_name text not null,
  reason text not null,
  counts jsonb not null,
  purged_at timestamptz not null default now()
);

alter table organization_purges enable row level security;
revoke all on organization_purges from anon, authenticated;

create function request_organization_deletion(p_org uuid, p_actor_account uuid) returns timestamptz as $$
declare
  v_owner_account uuid;
  v_prev text;
  v_after timestamptz;
begin
  select account_id into v_owner_account
  from organization_members where organization_id = p_org and base_role = 'p_owner' and is_active for update;
  if v_owner_account is null or v_owner_account is distinct from p_actor_account then
    raise exception using errcode = 'OW001', message = 'Hanya pemilik utama yang dapat menghapus organisasi';
  end if;
  if exists (select 1 from organizations where id = p_org and deletion_requested_at is not null) then
    raise exception using errcode = 'DL001', message = 'Penghapusan organisasi sudah diminta';
  end if;
  select status into v_prev from organization_subscriptions where organization_id = p_org for update;
  if v_prev is null or v_prev = 'pending_verification' then
    raise exception using errcode = '22023', message = 'Organisasi belum diverifikasi';
  end if;
  v_after := now() + interval '30 days';
  update organizations set
    deletion_requested_at = now(),
    deletion_requested_by = p_actor_account,
    purge_after = v_after,
    deletion_previous_status = v_prev
  where id = p_org;
  perform set_organization_status(p_org, 'cancelled', 'penghapusan oleh pemilik');
  update invitations set status = 'revoked' where organization_id = p_org and status = 'pending';
  return v_after;
end;
$$ language plpgsql security definer set search_path = public;

create function cancel_organization_deletion(p_org uuid, p_actor_account uuid) returns void as $$
declare
  v_owner_account uuid;
  v_prev text;
begin
  select account_id into v_owner_account
  from organization_members where organization_id = p_org and base_role = 'p_owner' and is_active for update;
  if v_owner_account is null or v_owner_account is distinct from p_actor_account then
    raise exception using errcode = 'OW001', message = 'Hanya pemilik utama yang dapat memulihkan organisasi';
  end if;
  select deletion_previous_status into v_prev
  from organizations where id = p_org and deletion_requested_at is not null and purge_after > now() for update;
  if not found then
    raise exception using errcode = 'DL002', message = 'Tidak ada penghapusan yang bisa dibatalkan';
  end if;
  update organizations set
    deletion_requested_at = null, deletion_requested_by = null, purge_after = null, deletion_previous_status = null
  where id = p_org;
  perform set_organization_status(p_org, coalesce(v_prev, 'active'), 'pemulihan oleh pemilik');
end;
$$ language plpgsql security definer set search_path = public;

create function purge_candidates()
returns table (organization_id uuid, name text, reason text, since timestamptz, eligible_at timestamptz) as $$
  select o.id, o.name, 'owner_deleted', o.deletion_requested_at, o.purge_after
  from organizations o
  where o.deletion_requested_at is not null and o.purge_after <= now()
  union all
  select o.id, o.name, 'grace_expired',
    (coalesce(s.current_period_end, s.trial_ends_at) + 1)::timestamptz,
    (coalesce(s.current_period_end, s.trial_ends_at) + sp.grace_days + 1)::timestamptz
  from organizations o
  join organization_subscriptions s on s.organization_id = o.id
  join subscription_plans sp on sp.code = s.plan_code
  where o.deletion_requested_at is null and subscription_phase(o.id) = 'ended'
$$ language sql stable security definer set search_path = public;

create function purge_organization(p_org uuid, p_execute boolean default false) returns jsonb as $$
declare
  v_name text;
  v_reason text;
  v_tenants uuid[];
  v_member_accounts uuid[];
  v_steps constant text[] := array[
    'order_payments:t', 'order_items:t', 'cash_ledger:t', 'orders:t', 'payroll_runs:t', 'checkins:t', 'checkin_points:t',
    'resource_bookings:t', 'bookings:t', 'classes:t', 'class_types:t', 'resource_hours:t', 'resources:t',
    'coach_certifications:t', 'invoices:t', 'subscriptions:t', 'membership_packages:t', 'promo:t', 'products:t',
    'order_counters:t', 'tenant_module_overrides:t', 'consents:to', 'audit_log:to', 'members:t',
    'organization_member_clubs:t', 'invitations:o', 'profiles:t', 'locations:t', 'platform_subscriptions:t',
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
  v_member_accounts := array(
    select distinct member_account_id from profiles where tenant_id = any(v_tenants) and member_account_id is not null
  );

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
    if v_table = 'profiles' then
      if p_execute then
        delete from member_accounts m
        where m.id = any(v_member_accounts) and not exists (select 1 from profiles p where p.member_account_id = m.id);
        get diagnostics v_count = row_count;
      else
        select count(*) into v_count from member_accounts m where m.id = any(v_member_accounts);
      end if;
      v_counts := v_counts || jsonb_build_object('member_accounts', v_count);
    end if;
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

revoke execute on function request_organization_deletion(uuid, uuid) from public, anon, authenticated;
revoke execute on function cancel_organization_deletion(uuid, uuid) from public, anon, authenticated;
revoke execute on function purge_candidates() from public, anon, authenticated;
revoke execute on function purge_organization(uuid, boolean) from public, anon, authenticated;
grant execute on function request_organization_deletion(uuid, uuid) to service_role;
grant execute on function cancel_organization_deletion(uuid, uuid) to service_role;
grant execute on function purge_candidates() to service_role;
grant execute on function purge_organization(uuid, boolean) to service_role;
