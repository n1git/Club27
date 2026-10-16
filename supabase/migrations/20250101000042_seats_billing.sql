alter table subscription_plans
  add column trial_seats int not null default 1 check (trial_seats > 0),
  add column grace_days int not null default 365 check (grace_days >= 0);

update subscription_plans set trial_days = 14;

alter table organization_subscriptions
  add column seats int not null default 1 check (seats >= 1),
  add column pending_seats int check (pending_seats >= 1),
  add column pending_seats_from date,
  add constraint organization_subscriptions_pending_pair_check
    check ((pending_seats is null) = (pending_seats_from is null));

create function set_initial_seats() returns trigger as $$
begin
  new.seats := coalesce((select trial_seats from subscription_plans where code = new.plan_code), 1);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function set_initial_seats() from public, anon, authenticated;

create trigger organization_subscriptions_initial_seats before insert on organization_subscriptions
  for each row execute function set_initial_seats();

insert into permissions (code, module, label, owner_only, sort_order) values
  ('billing.manage', 'Klub', 'Mengelola langganan dan seat organisasi', false, 124);

alter table subscription_renewals
  add column kind text not null default 'renewal' check (kind in ('renewal', 'seats')),
  add column seats_added int check (seats_added is null or seats_added > 0),
  add constraint subscription_renewals_seats_pair_check check ((kind = 'seats') = (seats_added is not null));

create function subscription_phase(p_org uuid) returns text as $$
declare
  r record;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_lapsed date;
begin
  select s.status, s.trial_ends_at, s.current_period_end, p.grace_days into r
  from organization_subscriptions s
  join subscription_plans p on p.code = s.plan_code
  where s.organization_id = p_org;
  if not found then
    return null;
  end if;
  if r.status = 'pending_verification' then
    return 'unverified';
  elsif r.status = 'pending' then
    return 'pending';
  elsif r.status in ('suspended', 'cancelled') then
    return 'suspended';
  elsif r.status = 'trial' then
    if r.trial_ends_at is null or r.trial_ends_at >= v_today then
      return 'trial';
    end if;
    v_lapsed := r.trial_ends_at;
  elsif r.status = 'active' then
    if r.current_period_end is null or r.current_period_end >= v_today then
      return 'active';
    end if;
    v_lapsed := r.current_period_end;
  else
    v_lapsed := coalesce(r.current_period_end, r.trial_ends_at);
  end if;
  if v_lapsed is not null and v_today <= v_lapsed + r.grace_days then
    return 'grace';
  end if;
  return 'ended';
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function subscription_phase(uuid) from public, anon, authenticated;
grant execute on function subscription_phase(uuid) to service_role;

create or replace function enforce_billing_gate(p_org uuid) returns void as $$
declare
  v_phase text := subscription_phase(p_org);
begin
  if v_phase is null or v_phase in ('trial', 'active') then
    return;
  end if;
  if not exists (select 1 from tenants where organization_id = p_org) then
    return;
  end if;
  if v_phase = 'unverified' then
    raise exception using errcode = 'SW003',
      message = 'Email pendaftaran belum diverifikasi. Buka tautan verifikasi yang dikirim ke email pemilik.';
  elsif v_phase = 'pending' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi belum aktif. Pemilik dapat mengajukan aktivasi di halaman Langganan.';
  elsif v_phase = 'suspended' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sedang ditangguhkan atau dibatalkan. Hubungi admin platform 27 Club.';
  elsif v_phase = 'grace' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sudah berakhir dan data hanya bisa dibaca. Pemilik dapat memperpanjang di halaman Langganan.';
  else
    raise exception using errcode = 'SW003',
      message = 'Masa tenggang langganan organisasi sudah berakhir. Pemilik dapat memperpanjang di halaman Langganan.';
  end if;
end;
$$ language plpgsql stable security definer set search_path = public;

create function enforce_org_writable() returns trigger as $$
declare
  v_row jsonb;
  v_tenant uuid;
  v_org uuid;
begin
  if auth.uid() is not null then
    v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    v_tenant := (v_row ->> 'tenant_id')::uuid;
    if v_tenant is not null then
      select organization_id into v_org from tenants where id = v_tenant;
      if coalesce(subscription_phase(v_org), 'active') not in ('trial', 'active') then
        perform enforce_billing_gate(v_org);
        raise exception using errcode = 'SW003', message = 'Langganan organisasi tidak aktif.';
      end if;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_org_writable() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
    where c.relkind = 'r'
      and c.relnamespace = 'public'::regnamespace
      and c.relname not in ('audit_log', 'consents', 'platform_subscriptions', 'organization_member_clubs')
  loop
    execute format(
      'create trigger a00_org_writable before insert or update or delete on %I for each row execute function enforce_org_writable()',
      r.relname
    );
  end loop;
end;
$$;

create function enforce_seat_limit() returns trigger as $$
declare
  v_seats int;
  v_pending int;
  v_used int;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;
  select seats, pending_seats into v_seats, v_pending
  from organization_subscriptions where organization_id = new.organization_id for update;
  if not found then
    return new;
  end if;
  perform enforce_billing_gate(new.organization_id);
  select count(*) into v_used
  from organization_members
  where organization_id = new.organization_id and is_active and id <> new.id;
  if v_used >= least(v_seats, coalesce(v_pending, v_seats)) then
    raise exception using errcode = 'SW005',
      message = format('Seat penuh: organisasi memakai %s dari %s seat. Tambah seat di halaman Langganan.', v_used, least(v_seats, coalesce(v_pending, v_seats)));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_seat_limit() from public, anon, authenticated;

create trigger organization_members_enforce_seats before insert or update of is_active on organization_members
  for each row execute function enforce_seat_limit();

create function seat_quote(p_org uuid, p_add int)
returns table (seats_before int, seats_after int, unit_price numeric, remaining_days int, period_days int, amount numeric) as $$
declare
  s organization_subscriptions%rowtype;
  v_price numeric;
  v_free numeric;
  v_factor numeric;
  v_unit numeric;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_start date;
  v_period int;
  v_remaining int;
begin
  if p_add is null or p_add < 1 or p_add > 1000 then
    raise exception using errcode = '22023', message = 'Jumlah seat tidak valid';
  end if;
  select * into s from organization_subscriptions where organization_id = p_org;
  if s.organization_id is null then
    raise exception 'subscription not found';
  end if;
  if s.status <> 'active' or s.current_period_end is null or s.current_period_end < v_today then
    raise exception using errcode = '22023',
      message = 'Seat tambahan hanya bisa dibeli saat langganan aktif. Perpanjang langganan lebih dulu.';
  end if;
  select price_per_user_month, yearly_free_months into v_price, v_free from subscription_plans where code = s.plan_code;
  v_factor := case when s.billing_period = 'yearly' then 12 - v_free else 1 end;
  v_unit := v_price * v_factor;
  v_start := coalesce(s.current_period_start, s.current_period_end - case when s.billing_period = 'yearly' then 364 else 30 end);
  v_period := greatest(s.current_period_end - v_start + 1, 1);
  v_remaining := s.current_period_end - v_today + 1;
  return query select
    s.seats,
    s.seats + p_add,
    v_unit,
    v_remaining,
    v_period,
    round(p_add * v_unit * v_remaining / v_period, 0);
end;
$$ language plpgsql stable security definer set search_path = public;

create function request_seat_purchase(p_org uuid, p_requested_by uuid, p_add int) returns uuid as $$
declare
  v_id uuid;
  s organization_subscriptions%rowtype;
  q record;
begin
  perform 1 from organization_subscriptions where organization_id = p_org for update;
  if not found then
    raise exception 'subscription not found';
  end if;
  select * into q from seat_quote(p_org, p_add);
  select * into s from organization_subscriptions where organization_id = p_org;

  update subscription_renewals set status = 'cancelled' where organization_id = p_org and status = 'pending';
  insert into subscription_renewals (
    organization_id, plan_code, billing_period, users, unit_price, months, amount, requested_by, kind, seats_added
  ) values (
    p_org, s.plan_code, s.billing_period, q.seats_after, q.unit_price,
    round(q.remaining_days::numeric / q.period_days * case when s.billing_period = 'yearly' then 12 else 1 end, 4),
    q.amount, p_requested_by, 'seats', p_add
  ) returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

drop function request_renewal(uuid, uuid, text, text);

create function request_renewal(p_org uuid, p_owner uuid, p_plan text, p_period text, p_seats int default null) returns uuid as $$
declare
  v_id uuid;
  v_limit int;
  v_clubs int;
  v_seats int;
  v_used int;
  v_mid boolean;
  s organization_subscriptions%rowtype;
  q record;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not exists (select 1 from subscription_plans where code = p_plan and is_active) then
    raise exception using errcode = '22023', message = 'Paket tidak tersedia';
  end if;
  select * into s from organization_subscriptions where organization_id = p_org for update;
  if s.organization_id is null then
    raise exception 'subscription not found';
  end if;

  select coalesce(s.club_limit_override, sp.club_limit) into v_limit from subscription_plans sp where sp.code = p_plan;
  select count(*) into v_clubs from tenants where organization_id = p_org;
  if v_limit is not null and v_clubs > v_limit then
    raise exception using errcode = 'SW004',
      message = format('Paket ini hanya untuk %s klub, sedangkan organisasi Anda punya %s klub.', v_limit, v_clubs);
  end if;

  v_mid := s.status = 'active' and s.current_period_end is not null and s.current_period_end >= v_today;
  v_seats := coalesce(p_seats, s.pending_seats, s.seats);
  v_used := organization_internal_users(p_org);
  if v_seats < 1 or v_seats > 1000 then
    raise exception using errcode = '22023', message = 'Jumlah seat tidak valid';
  end if;
  if v_seats < v_used then
    raise exception using errcode = '22023',
      message = format('Jumlah seat tidak boleh kurang dari pengguna aktif (%s). Nonaktifkan pengguna lebih dulu.', v_used);
  end if;
  if v_mid and v_seats > s.seats then
    raise exception using errcode = '22023',
      message = 'Menambah seat saat langganan berjalan dilakukan lewat pembelian seat.';
  end if;

  select * into q from platform_quote(p_plan, p_period, v_seats);

  update subscription_renewals set status = 'cancelled' where organization_id = p_org and status = 'pending';
  insert into subscription_renewals (organization_id, plan_code, billing_period, users, unit_price, months, amount, requested_by)
  values (p_org, p_plan, p_period, q.users, q.unit_price, q.months, q.total, p_owner)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function confirm_renewal(
  p_renewal_id uuid,
  p_actor text,
  p_provider text default 'manual',
  p_provider_ref text default null
) returns date as $$
declare
  r subscription_renewals%rowtype;
  s organization_subscriptions%rowtype;
  v_end date;
  v_start date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_seats int;
  v_pending int;
  v_used int;
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

  select * into s from organization_subscriptions where organization_id = r.organization_id for update;

  if r.kind = 'seats' then
    v_seats := s.seats + r.seats_added;
    v_pending := case when s.pending_seats is null then null else s.pending_seats + r.seats_added end;
    if v_pending is not null and v_pending >= v_seats then
      v_pending := null;
    end if;
    update organization_subscriptions set
      seats = v_seats,
      pending_seats = v_pending,
      pending_seats_from = case when v_pending is null then null else pending_seats_from end
    where organization_id = r.organization_id;
    update subscription_renewals set
      status = 'paid',
      paid_at = now(),
      confirmed_by = p_actor,
      provider = coalesce(p_provider, 'manual'),
      provider_ref = p_provider_ref,
      period_start = s.current_period_start,
      period_end = s.current_period_end
    where id = r.id;
    return s.current_period_end;
  end if;

  v_start := case when s.status = 'active' and s.current_period_end is not null and s.current_period_end >= v_today then s.current_period_end + 1 else v_today end;

  update organization_subscriptions set plan_code = r.plan_code, billing_period = r.billing_period
  where organization_id = r.organization_id;
  perform set_organization_status(r.organization_id, 'active', p_actor, v_start, null);
  select current_period_end into v_end from organization_subscriptions where organization_id = r.organization_id;

  v_used := organization_internal_users(r.organization_id);
  if v_start > v_today and r.users < s.seats then
    v_pending := greatest(r.users, v_used);
    update organization_subscriptions set
      pending_seats = case when v_pending < s.seats then v_pending end,
      pending_seats_from = case when v_pending < s.seats then v_start end
    where organization_id = r.organization_id;
  else
    update organization_subscriptions set
      seats = greatest(r.users, v_used),
      pending_seats = null,
      pending_seats_from = null
    where organization_id = r.organization_id;
  end if;

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

create or replace function expire_subscriptions() returns int as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_count int;
begin
  update organization_subscriptions set status = 'expired'
  where (status = 'active' and current_period_end < v_today)
     or (status = 'trial' and trial_ends_at < v_today);
  get diagnostics v_count = row_count;

  update organization_subscriptions set seats = pending_seats, pending_seats = null, pending_seats_from = null
  where pending_seats is not null and pending_seats_from <= v_today;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function seat_quote(uuid, int) from public, anon, authenticated;
revoke execute on function request_seat_purchase(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function request_renewal(uuid, uuid, text, text, int) from public, anon, authenticated;
revoke execute on function confirm_renewal(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function expire_subscriptions() from public, anon, authenticated;
grant execute on function seat_quote(uuid, int) to service_role;
grant execute on function request_seat_purchase(uuid, uuid, int) to service_role;
grant execute on function request_renewal(uuid, uuid, text, text, int) to service_role;
grant execute on function confirm_renewal(uuid, text, text, text) to service_role;
grant execute on function expire_subscriptions() to service_role;

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
  s.seats,
  s.pending_seats,
  q.unit_price,
  q.months,
  q.total,
  q.per_month
from organizations o
left join organization_subscriptions s on s.organization_id = o.id
left join subscription_plans sp on sp.code = s.plan_code
left join lateral (
  select * from platform_quote(s.plan_code, s.billing_period, coalesce(s.pending_seats, s.seats))
  where s.plan_code is not null
) q on true;

revoke all on platform_organization_usage from anon, authenticated;
