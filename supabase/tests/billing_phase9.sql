\set ON_ERROR_STOP on
begin;

insert into accounts (email, full_name, password_hash) values ('bill@t.test', 'Bill Owner', 'h');

do $$
declare
  v_acc uuid := (select id from accounts where email = 'bill@t.test');
  r record;
  v_org uuid;
  v_a uuid; v_b uuid; v_s uuid;
  ra subscription_renewals; rb subscription_renewals; rs subscription_renewals;
  v_period text := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM');
begin
  assert (select count(*) from billing_issuer) = 1, 'one issuer row';
  assert (select name from billing_issuer) = 'N-1 Labs', 'issuer seeded';
  begin insert into billing_issuer (id, name, address) values (false, 'x', 'y'); assert false, 'single issuer row'; exception when check_violation then null; end;

  select * into r from register_organization('Org Bill', 'Club Bill', v_acc, 'plus', 'monthly', 'swimming');
  v_org := r.organization_id;
  update organizations set billing_address = 'Jl. Uji 1, Semarang' where id = v_org;

  v_a := request_renewal(v_org, null, 'plus', 'yearly', 2);
  select * into ra from subscription_renewals where id = v_a;
  assert ra.invoice_number = 'INV-' || v_period || '-0001', 'first invoice number of the month: ' || ra.invoice_number;
  assert ra.receipt_number is null, 'no receipt before payment';
  assert ra.invoice_date = (now() at time zone 'Asia/Jakarta')::date, 'invoice date is today in WIB';
  assert ra.issuer ->> 'name' = 'N-1 Labs', 'issuer snapshot';
  assert ra.bill_to ->> 'name' = 'Org Bill', 'bill to name';
  assert ra.bill_to ->> 'email' = 'bill@t.test', 'bill to falls back to the owner email';
  assert ra.bill_to ->> 'address' = 'Jl. Uji 1, Semarang', 'bill to address';
  assert jsonb_array_length(ra.items) = 1, 'one item line';
  assert (ra.items -> 0 ->> 'qty')::int = 2, 'qty is seats';
  assert (ra.items -> 0 ->> 'amount')::numeric = ra.amount, 'line amount equals total';
  assert (ra.items -> 0 ->> 'unit_price')::numeric * 2 = ra.amount, 'unit price times qty equals total';
  assert ra.items -> 0 ->> 'description' like '% · tahunan (10 bulan)', 'yearly description: ' || (ra.items -> 0 ->> 'description');

  update billing_issuer set name = 'Nama Baru';
  update organizations set name = 'Org Rename' where id = v_org;
  select * into ra from subscription_renewals where id = v_a;
  assert ra.issuer ->> 'name' = 'N-1 Labs' and ra.bill_to ->> 'name' = 'Org Bill', 'issued invoice keeps its snapshot';
  update billing_issuer set name = 'N-1 Labs';

  begin update subscription_renewals set amount = 1 where id = v_a; assert false, 'amount locked'; exception when sqlstate 'IV001' then null; end;
  begin update subscription_renewals set invoice_number = 'INV-X' where id = v_a; assert false, 'number locked'; exception when sqlstate 'IV001' then null; end;
  begin update subscription_renewals set bill_to = '{}' where id = v_a; assert false, 'bill to locked'; exception when sqlstate 'IV001' then null; end;
  begin delete from subscription_renewals where id = v_a; assert false, 'delete refused'; exception when sqlstate 'IV003' then null; end;
  update subscription_renewals set payment_order_id = 'ord-1', payment_url = 'https://pay', payment_method = 'QRIS' where id = v_a;

  v_b := request_renewal(v_org, null, 'plus', 'monthly', 2);
  assert (select status from subscription_renewals where id = v_a) = 'cancelled', 'new request cancels the old one';
  select * into rb from subscription_renewals where id = v_b;
  assert rb.invoice_number = 'INV-' || v_period || '-0002', 'numbers are sequential';
  assert (select invoice_number from subscription_renewals where id = v_a) = 'INV-' || v_period || '-0001', 'cancelled invoice keeps its number';

  perform confirm_renewal(v_b, 'test', 'midtrans', 'trx-1');
  select * into rb from subscription_renewals where id = v_b;
  assert rb.status = 'paid', 'paid';
  assert rb.receipt_number = 'RZ-' || v_period || '-0001', 'first receipt number: ' || coalesce(rb.receipt_number, 'null');
  perform confirm_renewal(v_b, 'test', 'midtrans', 'trx-1');
  assert (select receipt_number from subscription_renewals where id = v_b) = rb.receipt_number, 'repeat confirmation keeps the receipt';
  assert (select last from billing_counters where kind = 'receipt' and period = v_period) = 1, 'no receipt number wasted';
  begin update subscription_renewals set status = 'cancelled' where id = v_b; assert false, 'paid is final'; exception when sqlstate 'IV002' then null; end;
  begin update subscription_renewals set receipt_number = null where id = v_b; assert false, 'receipt locked'; exception when sqlstate 'IV001' then null; end;
  update subscription_renewals set payment_method = 'Visa •••• 1343' where id = v_b;

  update organization_subscriptions set status = 'active', current_period_start = current_date, current_period_end = current_date + 30 where organization_id = v_org;
  v_s := request_seat_purchase(v_org, null, 1);
  select * into rs from subscription_renewals where id = v_s;
  assert rs.invoice_number = 'INV-' || v_period || '-0003', 'seat purchase gets the next invoice number';
  assert (rs.items -> 0 ->> 'qty')::int = 1 and (rs.items -> 0 ->> 'amount')::numeric = rs.amount, 'seat line is one prorated amount';
  assert rs.items -> 0 ->> 'description' like '%tambah 1 seat%', 'seat description';
  assert rs.due_date = rs.invoice_date, 'seat purchase is due on issue';

  perform set_config('ruzz.purge', 'on', true);
  delete from subscription_renewals where id = v_s;
  perform set_config('ruzz.purge', 'off', true);
end $$;

set local role authenticated;
do $$
begin
  begin perform * from billing_issuer; assert false, 'issuer hidden from clients'; exception when insufficient_privilege then null; end;
  begin perform * from billing_counters; assert false, 'counters hidden from clients'; exception when insufficient_privilege then null; end;
  assert not has_function_privilege('authenticated', 'next_billing_number(text, timestamptz)', 'execute'), 'counter function not callable';
end $$;
reset role;

rollback;
\echo billing_phase9 OK
