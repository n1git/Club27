alter table subscription_plans drop constraint subscription_plans_code_check;
alter table subscription_plans add constraint subscription_plans_code_check check (code ~ '^[a-z][a-z0-9_]{1,29}$');

alter table subscription_plans
  add column min_seats int not null default 1 check (min_seats >= 1);

insert into subscription_plans (code, name, price_per_seat_month, club_limit, trial_days, trial_seats, yearly_free_months, grace_days, min_seats, is_active)
values ('plus', '27 Club Plus', 75000, 5, 30, 1, 0.5, 365, 2, true)
on conflict (code) do update set
  name = excluded.name,
  price_per_seat_month = excluded.price_per_seat_month,
  club_limit = excluded.club_limit,
  trial_days = excluded.trial_days,
  trial_seats = excluded.trial_seats,
  yearly_free_months = excluded.yearly_free_months,
  grace_days = excluded.grace_days,
  min_seats = excluded.min_seats,
  is_active = true;

update organization_subscriptions s
set club_limit_override = c.n
from (select organization_id, count(*)::int as n from clubs group by organization_id) c
where c.organization_id = s.organization_id
  and c.n > (select club_limit from subscription_plans where code = 'plus')
  and s.club_limit_override is null
  and s.plan_code in ('standard', 'advanced');

update organization_subscriptions set plan_code = 'plus' where plan_code in ('standard', 'advanced');
update subscription_renewals set plan_code = 'plus' where plan_code in ('standard', 'advanced');

delete from subscription_plans where code in ('standard', 'advanced');

create or replace function platform_quote(p_plan text, p_period text, p_users integer)
returns table(users integer, unit_price numeric, months numeric, total numeric, per_month numeric)
language plpgsql stable set search_path to 'public' as $function$
declare
  v_price numeric;
  v_free numeric;
  v_min int;
  v_users int;
  v_months numeric;
  v_span numeric;
begin
  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'invalid billing period';
  end if;
  select price_per_seat_month, yearly_free_months, min_seats into v_price, v_free, v_min
  from subscription_plans where code = p_plan;
  if v_price is null then
    raise exception 'plan not found';
  end if;
  v_users := greatest(coalesce(p_users, 1), v_min);
  v_months := case when p_period = 'yearly' then 12 - v_free else 1 end;
  v_span := case when p_period = 'yearly' then 12 else 1 end;
  return query select
    v_users,
    v_price,
    v_months,
    round(v_users * v_price * v_months, 2),
    round(v_users * v_price * v_months / v_span, 2);
end;
$function$;

create or replace function request_renewal(p_org uuid, p_owner uuid, p_plan text, p_period text, p_seats integer default null)
returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid;
  v_limit int;
  v_clubs int;
  v_seats int;
  v_used int;
  v_min int;
  v_mid boolean;
  s organization_subscriptions%rowtype;
  q record;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select min_seats into v_min from subscription_plans where code = p_plan and is_active;
  if v_min is null then
    raise exception using errcode = '22023', message = 'Paket tidak tersedia';
  end if;
  select * into s from organization_subscriptions where organization_id = p_org for update;
  if s.organization_id is null then
    raise exception 'subscription not found';
  end if;

  select coalesce(s.club_limit_override, sp.club_limit) into v_limit from subscription_plans sp where sp.code = p_plan;
  select count(*) into v_clubs from clubs where organization_id = p_org;
  if v_limit is not null and v_clubs > v_limit then
    raise exception using errcode = 'SW004',
      message = format('Paket ini hanya untuk %s klub, sedangkan organisasi Anda punya %s klub.', v_limit, v_clubs);
  end if;

  v_mid := s.status = 'active' and s.current_period_end is not null and s.current_period_end >= v_today;
  v_seats := coalesce(p_seats, s.pending_seats, s.seats);
  v_used := organization_seats_used(p_org);
  if v_seats < 1 or v_seats > 1000 then
    raise exception using errcode = '22023', message = 'Jumlah seat tidak valid';
  end if;
  if v_seats < v_min then
    raise exception using errcode = '22023', message = format('Minimal pembelian %s seat.', v_min);
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
$function$;
