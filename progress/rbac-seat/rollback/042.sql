begin;

do $$
declare
  r record;
begin
  for r in select c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 'a00_org_writable' loop
    execute format('drop trigger a00_org_writable on %I', r.relname);
  end loop;
end $$;

drop view platform_organization_usage;

create view platform_organization_usage as
select
  o.id as organization_id,
  o.name,
  s.plan_code,
  s.billing_period,
  s.status,
  s.trial_ends_at,
  s.current_period_start,
  s.current_period_end,
  s.club_limit_override,
  coalesce(s.club_limit_override, sp.club_limit) as club_limit,
  (select count(*) from tenants t where t.organization_id = o.id) as clubs,
  coalesce((select sum(u.active_members) from platform_tenant_usage u where u.organization_id = o.id), 0)::bigint as members,
  organization_internal_users(o.id) as internal_users,
  q.unit_price,
  q.months,
  q.total,
  q.per_month
from organizations o
left join organization_subscriptions s on s.organization_id = o.id
left join subscription_plans sp on sp.code = s.plan_code
left join lateral (
  select * from platform_quote(s.plan_code, s.billing_period, organization_internal_users(o.id))
  where s.plan_code is not null
) q on true;

revoke all on platform_organization_usage from anon, authenticated;

drop trigger organization_members_enforce_seats on organization_members;
drop trigger organization_subscriptions_initial_seats on organization_subscriptions;
drop function enforce_seat_limit();
drop function enforce_org_writable();
drop function set_initial_seats();
drop function request_seat_purchase(uuid, uuid, int);
drop function seat_quote(uuid, int);
drop function request_renewal(uuid, uuid, text, text, int);
drop function confirm_renewal(uuid, text, text, text);
drop function expire_subscriptions();

create or replace function enforce_billing_gate(p_org uuid) returns void as $$
declare
  v_status text;
  v_trial date;
  v_end date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select status, trial_ends_at, current_period_end into v_status, v_trial, v_end
  from organization_subscriptions where organization_id = p_org;
  if v_status is null then
    return;
  end if;
  if not exists (select 1 from tenants where organization_id = p_org) then
    return;
  end if;
  if v_status = 'pending_verification' then
    raise exception using errcode = 'SW003',
      message = 'Email pendaftaran belum diverifikasi. Buka tautan verifikasi yang dikirim ke email pemilik.';
  elsif v_status = 'pending' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi belum aktif. Pemilik dapat mengajukan aktivasi di halaman Langganan.';
  elsif v_status in ('suspended', 'cancelled') then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sedang ditangguhkan atau dibatalkan. Hubungi admin platform 27club.';
  elsif v_status = 'expired'
    or (v_status = 'trial' and v_trial < v_today)
    or (v_status = 'active' and v_end < v_today) then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sudah berakhir. Pemilik dapat memperpanjang di halaman Langganan.';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create function request_renewal(p_org uuid, p_owner uuid, p_plan text, p_period text) returns uuid as $$
declare
  v_id uuid;
  v_limit int;
  v_clubs int;
  q record;
begin
  if not exists (select 1 from subscription_plans where code = p_plan and is_active) then
    raise exception using errcode = '22023', message = 'Paket tidak tersedia';
  end if;
  perform 1 from organization_subscriptions where organization_id = p_org for update;
  if not found then
    raise exception 'subscription not found';
  end if;

  select coalesce(s.club_limit_override, sp.club_limit) into v_limit
  from organization_subscriptions s, subscription_plans sp
  where s.organization_id = p_org and sp.code = p_plan;
  select count(*) into v_clubs from tenants where organization_id = p_org;
  if v_limit is not null and v_clubs > v_limit then
    raise exception using errcode = 'SW004',
      message = format('Paket ini hanya untuk %s klub, sedangkan organisasi Anda punya %s klub.', v_limit, v_clubs);
  end if;

  select * into q from platform_quote(p_plan, p_period, organization_internal_users(p_org));

  update subscription_renewals set status = 'cancelled' where organization_id = p_org and status = 'pending';
  insert into subscription_renewals (organization_id, plan_code, billing_period, users, unit_price, months, amount, requested_by)
  values (p_org, p_plan, p_period, q.users, q.unit_price, q.months, q.total, p_owner)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function confirm_renewal(
  p_renewal_id uuid,
  p_actor text,
  p_provider text default 'manual',
  p_provider_ref text default null
) returns date as $$
declare
  r subscription_renewals%rowtype;
  v_status text;
  v_end date;
  v_start date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into r from subscription_renewals where id = p_renewal_id for update;
  if r.id is null then
    raise exception 'renewal not found';
  end if;
  if r.status = 'paid' then
    return r.period_end;
  end if;
  if r.status = 'cancelled' and coalesce(p_provider, 'manual') = 'manual' then
    raise exception using errcode = '22023', message = 'Pengajuan sudah dibatalkan';
  end if;

  select status, current_period_end into v_status, v_end
  from organization_subscriptions where organization_id = r.organization_id for update;
  v_start := case when v_status = 'active' and v_end is not null and v_end >= v_today then v_end + 1 else v_today end;

  update organization_subscriptions set plan_code = r.plan_code, billing_period = r.billing_period
  where organization_id = r.organization_id;
  perform set_organization_status(r.organization_id, 'active', p_actor, v_start, null);
  select current_period_end into v_end from organization_subscriptions where organization_id = r.organization_id;

  update subscription_renewals set
    status = 'paid',
    paid_at = now(),
    confirmed_by = p_actor,
    provider = coalesce(p_provider, 'manual'),
    provider_ref = p_provider_ref,
    period_start = v_start,
    period_end = v_end
  where id = r.id;
  return v_end;
end;
$$ language plpgsql security definer set search_path = public;

create function expire_subscriptions() returns int as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_count int;
begin
  update organization_subscriptions set status = 'expired'
  where (status = 'active' and current_period_end < v_today)
     or (status = 'trial' and trial_ends_at < v_today);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public;

drop function subscription_phase(uuid);

revoke execute on function request_renewal(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function confirm_renewal(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function expire_subscriptions() from public, anon, authenticated;
grant execute on function request_renewal(uuid, uuid, text, text) to service_role;
grant execute on function confirm_renewal(uuid, text, text, text) to service_role;
grant execute on function expire_subscriptions() to service_role;

delete from subscription_renewals where kind = 'seats';
alter table subscription_renewals drop constraint subscription_renewals_seats_pair_check;
alter table subscription_renewals drop column kind, drop column seats_added;

delete from role_permissions where permission_code = 'billing.manage';
delete from permissions where code = 'billing.manage';

alter table organization_subscriptions
  drop constraint organization_subscriptions_pending_pair_check,
  drop column seats, drop column pending_seats, drop column pending_seats_from;

update subscription_plans set trial_days = 30 where code = 'standard';
update subscription_plans set trial_days = 0 where code = 'advanced';
alter table subscription_plans drop column trial_seats, drop column grace_days;

commit;
