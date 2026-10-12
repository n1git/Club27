alter table organization_subscriptions drop constraint organization_subscriptions_status_check;
alter table organization_subscriptions add constraint organization_subscriptions_status_check
  check (status in ('pending_verification', 'pending', 'trial', 'active', 'expired', 'suspended', 'cancelled'));

create table subscription_renewals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  plan_code text not null references subscription_plans(code),
  billing_period text not null check (billing_period in ('monthly', 'yearly')),
  users int not null check (users > 0),
  unit_price numeric not null check (unit_price >= 0),
  months numeric not null check (months > 0),
  amount numeric not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  provider text not null default 'manual' check (char_length(provider) <= 50),
  provider_ref text check (char_length(provider_ref) <= 200),
  period_start date,
  period_end date,
  requested_by uuid references org_owners(id),
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  confirmed_by text,
  unique (provider, provider_ref)
);

create unique index subscription_renewals_one_pending_idx on subscription_renewals(organization_id) where status = 'pending';
create index subscription_renewals_org_idx on subscription_renewals(organization_id, requested_at desc);

alter table subscription_renewals enable row level security;
revoke all on subscription_renewals from anon, authenticated;

create table subscription_reminders (
  organization_id uuid not null references organizations(id),
  due_date date not null,
  kind text not null check (kind in ('h7', 'h1')),
  sent_at timestamptz not null default now(),
  primary key (organization_id, due_date, kind)
);

alter table subscription_reminders enable row level security;
revoke all on subscription_reminders from anon, authenticated;

create or replace function set_organization_status(
  p_organization_id uuid,
  p_status text,
  p_actor text default null,
  p_period_start date default null,
  p_period_end date default null
) returns void as $$
declare
  v_period text;
  v_previous text;
  v_end date;
begin
  if p_status not in ('pending', 'trial', 'active', 'expired', 'suspended', 'cancelled') then
    raise exception 'invalid status';
  end if;

  select billing_period, status into v_period, v_previous
  from organization_subscriptions where organization_id = p_organization_id for update;
  if v_period is null then
    raise exception 'subscription not found';
  end if;

  v_end := coalesce(
    p_period_end,
    case when p_period_start is not null then p_period_start + case when v_period = 'yearly' then interval '1 year' else interval '1 month' end end
  );

  update organization_subscriptions set
    status = p_status,
    current_period_start = case when p_status = 'active' and p_period_start is not null then p_period_start else current_period_start end,
    current_period_end = case when p_status = 'active' and v_end is not null then v_end else current_period_end end,
    activated_at = case when p_status = 'active' and (v_previous <> 'active' or p_period_start is not null) then now() else activated_at end,
    activated_by = case when p_status = 'active' and (v_previous <> 'active' or p_period_start is not null) then p_actor else activated_by end
  where organization_id = p_organization_id;

  update tenants set is_active = (p_status in ('pending', 'trial', 'active', 'expired'))
  where organization_id = p_organization_id;
end;
$$ language plpgsql security definer set search_path = public;

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
      message = 'Langganan organisasi sedang ditangguhkan atau dibatalkan. Hubungi admin platform 27 Club.';
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
  if r.status <> 'pending' then
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

revoke execute on function request_renewal(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function confirm_renewal(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function expire_subscriptions() from public, anon, authenticated;
grant execute on function request_renewal(uuid, uuid, text, text) to service_role;
grant execute on function confirm_renewal(uuid, text, text, text) to service_role;
grant execute on function expire_subscriptions() to service_role;
