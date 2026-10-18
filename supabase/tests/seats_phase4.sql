\set ON_ERROR_STOP on
begin;

create function pg_temp.act(p_profile uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_profile, 'role', 'authenticated', 'club_id', (select club_id from club_profiles where id = p_profile),
    'account_id', (select account_id from club_profiles where id = p_profile), 'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.act(uuid) to public;

insert into accounts (email, full_name, password_hash) values
  ('own@t.test', 'Own', 'h'), ('s1@t.test', 'S1', 'h'), ('s2@t.test', 'S2', 'h'), ('s3@t.test', 'S3', 'h'),
  ('s4@t.test', 'S4', 'h'), ('adv@t.test', 'Adv', 'h');

do $$
declare
  aown uuid; a1 uuid; a2 uuid; a3 uuid; a4 uuid; aadv uuid;
  r record; radv record;
  v_org uuid; v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_id uuid; q record; n int; v_state text;
  p_owner uuid;
begin
  select id into aown from accounts where email = 'own@t.test';
  select id into a1 from accounts where email = 's1@t.test';
  select id into a2 from accounts where email = 's2@t.test';
  select id into a3 from accounts where email = 's3@t.test';
  select id into a4 from accounts where email = 's4@t.test';
  select id into aadv from accounts where email = 'adv@t.test';

  assert (select count(*) from subscription_plans where trial_days = 14) = (select count(*) from subscription_plans), 'every plan has a 14 day trial';
  assert (select count(*) from subscription_plans where grace_days = 365) = (select count(*) from subscription_plans), 'grace period is one year';

  select * into r from register_organization('Org Seat', 'Club Seat', aown, 'standard', 'monthly', 'swimming');
  select * into radv from register_organization('Org Adv', 'Club Adv', aadv, 'advanced', 'monthly', 'swimming');
  v_org := r.organization_id;
  p_owner := r.profile_id;

  assert (select status from organization_subscriptions where organization_id = radv.organization_id) = 'trial', 'every plan starts in trial';
  assert (select trial_ends_at from organization_subscriptions where organization_id = v_org) = v_today + 14, 'trial lasts 14 days';
  assert (select seats from organization_subscriptions where organization_id = v_org) = 1, 'trial has one seat';
  assert subscription_phase(v_org) = 'trial', 'phase trial';
  assert organization_seats_used(v_org) = 1, 'the first owner takes the seat';

  begin
    insert into organization_users (organization_id, account_id, email, full_name, base_role) values (v_org, a1, 's1@t.test', 'S1', 'staff');
    assert false, 'trial seat is full';
  exception when sqlstate 'SW005' then null; end;

  begin
    perform * from seat_quote(v_org, 1);
    assert false, 'seat purchase needs an active subscription';
  exception when sqlstate '22023' then null; end;

  begin
    perform request_renewal(v_org, null, 'standard', 'monthly', 0);
    assert false, 'seat count must be positive';
  exception when sqlstate '22023' then null; end;

  v_id := request_renewal(v_org, null, 'standard', 'monthly', 3);
  select * into q from subscription_renewals where id = v_id;
  assert q.amount = 3 * 150000 and q.users = 3 and q.kind = 'renewal', 'renewal quote uses the chosen seats';
  perform confirm_renewal(v_id, 'test');
  assert (select seats from organization_subscriptions where organization_id = v_org) = 3, 'paid renewal sets the seats';
  assert subscription_phase(v_org) = 'active', 'phase active';
  assert (select pending_seats from organization_subscriptions where organization_id = v_org) is null, 'no pending reduction';

  insert into organization_users (organization_id, account_id, email, full_name, base_role) values (v_org, a1, 's1@t.test', 'S1', 'staff');
  insert into organization_users (organization_id, account_id, email, full_name, base_role) values (v_org, a2, 's2@t.test', 'S2', 'staff');
  begin
    insert into organization_users (organization_id, account_id, email, full_name, base_role) values (v_org, a3, 's3@t.test', 'S3', 'staff');
    assert false, 'seats are full';
  exception when sqlstate 'SW005' then null; end;
  assert organization_seats_used(v_org) = 3, 'three seats used';

  set constraints all immediate;
  update organization_users set is_active = false where organization_id = v_org and account_id = a2;
  update organization_users set is_active = true where organization_id = v_org and account_id = a2;
  update organization_users set is_active = false where organization_id = v_org and account_id = a2;
  insert into organization_users (organization_id, account_id, email, full_name, base_role) values (v_org, a3, 's3@t.test', 'S3', 'staff');
  begin
    update organization_users set is_active = true where organization_id = v_org and account_id = a2;
    assert false, 'reactivation respects the seat limit';
  exception when sqlstate 'SW005' then null; end;
  update organization_users set is_active = false where organization_id = v_org and account_id = a3;

  select * into q from seat_quote(v_org, 2);
  assert q.amount = 2 * 150000 and q.remaining_days = q.period_days, 'a fresh period is not prorated';
  update organization_subscriptions set current_period_start = v_today - 15, current_period_end = v_today + 15 where organization_id = v_org;
  select * into q from seat_quote(v_org, 2);
  assert q.period_days = 31 and q.remaining_days = 16, 'remaining days count today';
  assert q.amount = round(2 * 150000 * 16 / 31.0, 0), 'monthly proration';
  update organization_subscriptions set billing_period = 'yearly', current_period_start = v_today - 100, current_period_end = v_today + 264 where organization_id = v_org;
  select * into q from seat_quote(v_org, 1);
  assert q.period_days = 365 and q.unit_price = 150000 * (12 - (select yearly_free_months from subscription_plans where code = 'standard')), 'yearly unit price';
  assert q.amount = round(q.unit_price * 265 / 365.0, 0), 'yearly proration';
  update organization_subscriptions set billing_period = 'monthly', current_period_start = v_today - 15, current_period_end = v_today + 15 where organization_id = v_org;

  v_id := request_seat_purchase(v_org, null, 2);
  select * into q from subscription_renewals where id = v_id;
  assert q.kind = 'seats' and q.seats_added = 2 and q.users = 5 and q.status = 'pending', 'seat purchase recorded';
  assert q.amount = round(2 * 150000 * 16 / 31.0, 0), 'recorded amount is the prorated one';
  perform confirm_renewal(v_id, 'test');
  perform confirm_renewal(v_id, 'test');
  assert (select seats from organization_subscriptions where organization_id = v_org) = 5, 'seats added once, idempotent';
  assert (select current_period_end from organization_subscriptions where organization_id = v_org) = v_today + 15, 'a seat purchase does not move the period';
  insert into organization_users (organization_id, account_id, email, full_name, base_role) values (v_org, a4, 's4@t.test', 'S4', 'staff');
  update organization_users set is_active = true where organization_id = v_org and account_id = a3;
  update organization_users set is_active = true where organization_id = v_org and account_id = a2;
  assert organization_seats_used(v_org) = 5, 'five seats used';

  begin
    perform request_renewal(v_org, null, 'standard', 'monthly', 4);
    assert false, 'cannot go below the active users';
  exception when sqlstate '22023' then null; end;
  begin
    perform request_renewal(v_org, null, 'standard', 'monthly', 6);
    assert false, 'mid period increases go through seat purchase';
  exception when sqlstate '22023' then null; end;

  update organization_users set is_active = false where organization_id = v_org and account_id in (a3, a4);
  v_id := request_renewal(v_org, null, 'standard', 'monthly', 3);
  select * into q from subscription_renewals where id = v_id;
  assert q.amount = 3 * 150000, 'renewal quote at reduced seats';
  perform confirm_renewal(v_id, 'test');
  select * into q from organization_subscriptions where organization_id = v_org;
  assert q.seats = 5 and q.pending_seats = 3 and q.pending_seats_from = v_today + 16, 'reduction waits for the next period';
  assert q.current_period_end > v_today + 15, 'early renewal extends the period';
  begin
    update organization_users set is_active = true where organization_id = v_org and account_id = a3;
    assert false, 'pending reduction already caps new seats';
  exception when sqlstate 'SW005' then null; end;

  update organization_subscriptions set pending_seats_from = v_today where organization_id = v_org;
  assert expire_subscriptions() >= 0, 'cron runs';
  select * into q from organization_subscriptions where organization_id = v_org;
  assert q.seats = 3 and q.pending_seats is null and q.pending_seats_from is null, 'reduction applied at the next period';

  update organization_subscriptions set current_period_end = v_today - 10, current_period_start = v_today - 40, status = 'active' where organization_id = v_org;
  assert subscription_phase(v_org) = 'grace', 'lapsed subscription enters the grace period';

  perform pg_temp.act(p_owner);
  begin
    insert into locations (club_id, name) values (r.club_id, 'Kolam');
    assert false, 'grace period is read only';
  exception when sqlstate 'SW003' then null; end;
  assert (select count(*) from locations) >= 0, 'reading stays possible';
  perform set_config('request.jwt.claims', '', true);
  insert into locations (club_id, name) values (r.club_id, 'Kolam');
  perform pg_temp.act(p_owner);
  begin
    update locations set address = 'x' where club_id = r.club_id;
    assert false, 'updates are blocked too';
  exception when sqlstate 'SW003' then null; end;
  begin
    delete from locations where club_id = r.club_id;
    assert false, 'deletes are blocked too';
  exception when sqlstate 'SW003' then null; end;
  perform set_config('request.jwt.claims', '', true);
  delete from locations where club_id = r.club_id;

  begin
    update organization_users set is_active = true where organization_id = v_org and account_id = a3;
    assert false, 'seat changes are blocked in the grace period';
  exception when sqlstate 'SW003' then null; end;

  update organization_subscriptions set current_period_end = v_today - 366, current_period_start = v_today - 396 where organization_id = v_org;
  assert subscription_phase(v_org) = 'ended', 'grace period ends after a year';
  update organization_subscriptions set current_period_end = v_today - 365 where organization_id = v_org;
  assert subscription_phase(v_org) = 'grace', 'last day of the grace period';

  update organization_subscriptions set status = 'expired', current_period_end = v_today - 3 where organization_id = v_org;
  assert subscription_phase(v_org) = 'grace', 'expired status in grace';
  update organization_subscriptions set status = 'trial', trial_ends_at = v_today - 1 where organization_id = v_org;
  assert subscription_phase(v_org) = 'grace', 'lapsed trial in grace';
  update organization_subscriptions set status = 'pending' where organization_id = v_org;
  assert subscription_phase(v_org) = 'pending', 'pending';
  update organization_subscriptions set status = 'suspended' where organization_id = v_org;
  assert subscription_phase(v_org) = 'suspended', 'suspended';
  update organization_subscriptions set status = 'pending_verification' where organization_id = v_org;
  assert subscription_phase(v_org) = 'unverified', 'unverified';

  update organization_subscriptions set status = 'expired', current_period_end = v_today - 5 where organization_id = v_org;
  v_id := request_renewal(v_org, null, 'standard', 'monthly', 4);
  perform confirm_renewal(v_id, 'test');
  select * into q from organization_subscriptions where organization_id = v_org;
  assert q.status = 'active' and q.seats = 4 and q.pending_seats is null and q.current_period_start = v_today, 'renewing after a lapse restarts today with the chosen seats';
  assert subscription_phase(v_org) = 'active', 'active again';
  perform pg_temp.act(p_owner);
  insert into locations (club_id, name) values (r.club_id, 'Kolam 2');
  perform set_config('request.jwt.claims', '', true);

  select count(*) into n
  from pg_class c
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'club_id' and not a.attisdropped
  where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
    and c.relname not in ('audit_log', 'consents', 'organization_user_clubs', 'club_join_requests')
    and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'a00_org_writable');
  assert n = 0, 'every club table carries the read-only guard';
end;
$$;

rollback;
