create table billing_issuer (
  id boolean primary key default true check (id),
  name text not null check (char_length(name) between 1 and 200),
  address text not null check (char_length(address) <= 500),
  email text check (char_length(email) <= 200),
  website text check (char_length(website) <= 200),
  footer text check (char_length(footer) <= 500),
  updated_at timestamptz not null default now()
);

insert into billing_issuer (name, address, website)
values ('N-1 Labs', E'Jl. Ketileng Asri IV/E no.2\nSemarang, Jawa Tengah 50727\nIndonesia', 'getruzz.com');

alter table billing_issuer enable row level security;
revoke all on billing_issuer from anon, authenticated;

create table billing_counters (
  kind text not null check (kind in ('invoice', 'receipt')),
  period text not null check (period ~ '^[0-9]{6}$'),
  last int not null default 0,
  primary key (kind, period)
);

alter table billing_counters enable row level security;
revoke all on billing_counters from anon, authenticated;

alter table organizations add column billing_address text check (char_length(billing_address) <= 500);
alter table organizations add column billing_email text check (char_length(billing_email) <= 200);

alter table subscription_renewals
  add column invoice_number text unique check (char_length(invoice_number) <= 30),
  add column invoice_date date,
  add column due_date date,
  add column receipt_number text unique check (char_length(receipt_number) <= 30),
  add column issuer jsonb,
  add column bill_to jsonb,
  add column items jsonb,
  add column payment_method text check (char_length(payment_method) <= 100);

create function next_billing_number(p_kind text, p_at timestamptz) returns text as $$
declare
  v_period text := to_char(p_at at time zone 'Asia/Jakarta', 'YYYYMM');
  v_last int;
begin
  insert into billing_counters (kind, period, last) values (p_kind, v_period, 1)
  on conflict (kind, period) do update set last = billing_counters.last + 1
  returning last into v_last;
  return case p_kind when 'invoice' then 'INV-' else 'RZ-' end || v_period || '-' || lpad(v_last::text, 4, '0');
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function next_billing_number(text, timestamptz) from public, anon, authenticated;

create function billing_snapshot(p_renewal subscription_renewals) returns subscription_renewals as $$
declare
  r subscription_renewals := p_renewal;
  v_org organizations%rowtype;
  v_owner_email text;
  v_plan text;
  v_end date;
begin
  select * into v_org from organizations where id = r.organization_id;
  select a.email into v_owner_email
  from organization_users u join accounts a on a.id = u.account_id
  where u.organization_id = r.organization_id and u.base_role = 'p_owner'
  limit 1;
  select name into v_plan from subscription_plans where code = r.plan_code;
  select current_period_end into v_end from organization_subscriptions where organization_id = r.organization_id;

  r.invoice_date := coalesce(r.invoice_date, (r.requested_at at time zone 'Asia/Jakarta')::date);
  r.due_date := coalesce(r.due_date, case
    when r.kind = 'renewal' and r.status = 'pending' and v_end is not null and v_end > r.invoice_date then v_end
    else r.invoice_date
  end);
  r.issuer := coalesce(r.issuer, (select jsonb_build_object('name', name, 'address', address, 'email', email, 'website', website, 'footer', footer) from billing_issuer));
  r.bill_to := coalesce(r.bill_to, jsonb_build_object(
    'name', v_org.name,
    'address', v_org.billing_address,
    'email', coalesce(v_org.billing_email, v_owner_email)
  ));
  r.items := coalesce(r.items, case
    when r.kind = 'seats' then jsonb_build_array(jsonb_build_object(
      'description', coalesce(v_plan, r.plan_code) || ' · tambah ' || r.seats_added || ' seat (prorata sampai akhir periode)',
      'qty', 1,
      'unit_price', r.amount,
      'amount', r.amount
    ))
    else jsonb_build_array(jsonb_build_object(
      'description', coalesce(v_plan, r.plan_code) || ' · ' || case r.billing_period when 'yearly' then 'tahunan' else 'bulanan' end
        || ' (' || trim(to_char(r.months, 'FM999990.####')) || ' bulan)',
      'qty', r.users,
      'unit_price', r.unit_price * r.months,
      'amount', r.amount
    ))
  end);
  return r;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function billing_snapshot(subscription_renewals) from public, anon, authenticated;

create function subscription_renewals_documents() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('ruzz.purge', true) = 'on' then
      return old;
    end if;
    raise exception using errcode = 'IV003', message = 'Tagihan yang sudah terbit tidak bisa dihapus';
  end if;

  if tg_op = 'INSERT' then
    new := billing_snapshot(new);
    new.invoice_number := next_billing_number('invoice', new.requested_at);
    if new.status = 'paid' then
      new.receipt_number := next_billing_number('receipt', coalesce(new.paid_at, now()));
    end if;
    return new;
  end if;

  if old.status = 'paid' and new.status <> 'paid' then
    raise exception using errcode = 'IV002', message = 'Tagihan yang sudah lunas tidak bisa diubah statusnya';
  end if;
  if (old.invoice_number is not null and new.invoice_number is distinct from old.invoice_number)
    or (old.receipt_number is not null and new.receipt_number is distinct from old.receipt_number)
    or (old.invoice_number is not null and (
      new.invoice_date is distinct from old.invoice_date
      or new.issuer is distinct from old.issuer
      or new.bill_to is distinct from old.bill_to
      or new.items is distinct from old.items
      or new.amount is distinct from old.amount
      or new.users is distinct from old.users
      or new.unit_price is distinct from old.unit_price
      or new.months is distinct from old.months
      or new.kind is distinct from old.kind
      or new.seats_added is distinct from old.seats_added
      or new.plan_code is distinct from old.plan_code
      or new.billing_period is distinct from old.billing_period
      or new.organization_id is distinct from old.organization_id
    )) then
    raise exception using errcode = 'IV001', message = 'Isi tagihan yang sudah terbit tidak bisa diubah';
  end if;

  if new.status = 'paid' and old.status <> 'paid' and new.receipt_number is null then
    new.receipt_number := next_billing_number('receipt', coalesce(new.paid_at, now()));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function subscription_renewals_documents() from public, anon, authenticated;

do $$
declare r subscription_renewals;
begin
  for r in select * from subscription_renewals where invoice_number is null order by requested_at, id loop
    r := billing_snapshot(r);
    update subscription_renewals set
      invoice_number = next_billing_number('invoice', r.requested_at),
      invoice_date = r.invoice_date,
      due_date = r.due_date,
      issuer = r.issuer,
      bill_to = r.bill_to,
      items = r.items
    where id = r.id;
  end loop;
  for r in select * from subscription_renewals where status = 'paid' and receipt_number is null order by coalesce(paid_at, requested_at), id loop
    update subscription_renewals set receipt_number = next_billing_number('receipt', coalesce(r.paid_at, r.requested_at)) where id = r.id;
  end loop;
end $$;

create trigger subscription_renewals_documents before insert or update or delete on subscription_renewals
  for each row execute function subscription_renewals_documents();
