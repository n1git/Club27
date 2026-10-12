alter table orders add column client_request_id uuid;
alter table order_payments add column client_request_id uuid;
alter table cash_ledger add column client_request_id uuid;

create unique index orders_client_request_idx on orders(client_request_id) where client_request_id is not null;
create unique index order_payments_client_request_idx on order_payments(client_request_id) where client_request_id is not null;
create unique index cash_ledger_client_request_idx on cash_ledger(client_request_id) where client_request_id is not null;

create function stamp_client_request_id() returns trigger as $$
begin
  if new.client_request_id is null then
    new.client_request_id := nullif(current_setting(tg_argv[0], true), '')::uuid;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

revoke execute on function stamp_client_request_id() from public, anon, authenticated;

create trigger orders_stamp_request before insert on orders
  for each row execute function stamp_client_request_id('club27.order_request');
create trigger order_payments_stamp_request before insert on order_payments
  for each row execute function stamp_client_request_id('club27.payment_request');

create function create_order_once(
  p_request_id uuid,
  p_member_id uuid,
  p_customer_name text,
  p_items jsonb,
  p_payments jsonb
) returns uuid as $$
declare
  v_id uuid;
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request id required';
  end if;
  perform pg_advisory_xact_lock(hashtext('order:' || p_request_id::text));
  select id into v_id from orders where client_request_id = p_request_id and tenant_id = current_tenant_id();
  if v_id is not null then
    return v_id;
  end if;
  perform set_config('club27.order_request', p_request_id::text, true);
  v_id := create_order(p_member_id, p_customer_name, p_items, p_payments);
  perform set_config('club27.order_request', '', true);
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function add_order_payment_once(
  p_request_id uuid,
  p_order_id uuid,
  p_method text,
  p_amount numeric,
  p_reference text
) returns text as $$
declare
  v_status text;
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request id required';
  end if;
  perform pg_advisory_xact_lock(hashtext('payment:' || p_request_id::text));
  if exists (
    select 1 from order_payments
    where client_request_id = p_request_id and order_id = p_order_id and tenant_id = current_tenant_id()
  ) then
    select status into v_status from orders where id = p_order_id;
    return v_status;
  end if;
  perform set_config('club27.payment_request', p_request_id::text, true);
  v_status := add_order_payment(p_order_id, p_method, p_amount, p_reference);
  perform set_config('club27.payment_request', '', true);
  return v_status;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_order_once(uuid, uuid, text, jsonb, jsonb) from public, anon;
revoke execute on function add_order_payment_once(uuid, uuid, text, numeric, text) from public, anon;
grant execute on function create_order_once(uuid, uuid, text, jsonb, jsonb) to authenticated, service_role;
grant execute on function add_order_payment_once(uuid, uuid, text, numeric, text) to authenticated, service_role;
