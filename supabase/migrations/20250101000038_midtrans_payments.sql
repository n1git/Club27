alter table subscription_renewals add column payment_order_id text unique check (char_length(payment_order_id) <= 50);
alter table subscription_renewals add column payment_url text check (char_length(payment_url) <= 500);

create or replace function confirm_renewal(
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

revoke execute on function confirm_renewal(uuid, text, text, text) from public, anon, authenticated;
grant execute on function confirm_renewal(uuid, text, text, text) to service_role;
