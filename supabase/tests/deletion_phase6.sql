\set ON_ERROR_STOP on
begin;

insert into accounts (email, full_name, password_hash) values
  ('own@t.test', 'Own', 'h'), ('keep@t.test', 'Keep', 'h'), ('co@t.test', 'Co', 'h');

do $$
declare
  aown uuid; akeep uuid; aco uuid;
  r record; k record; v_org uuid; v_club uuid; v_member uuid; v_pkg uuid; v_sub uuid;
  res jsonb; n bigint; v_after timestamptz; m_co uuid;
begin
  select id into aown from accounts where email = 'own@t.test';
  select id into akeep from accounts where email = 'keep@t.test';
  select id into aco from accounts where email = 'co@t.test';

  select * into r from register_organization('Org Hapus', 'Club Hapus', aown, 'standard', 'monthly', 'swimming');
  select * into k from register_organization('Org Tetap', 'Club Tetap', akeep, 'standard', 'monthly', 'swimming');
  v_org := r.organization_id; v_club := r.club_id;
  update organization_subscriptions set seats = 5;

  insert into organization_users (organization_id, account_id, email, full_name, base_role) values (v_org, aco, 'co@t.test', 'Co', 'owner') returning id into m_co;
  insert into club_profiles (club_id, role, full_name, email, owner_id, account_id) values (v_club, 'owner', 'Co', 'co@t.test', m_co, aco);

  insert into locations (club_id, name) values (v_club, 'Kolam'), (k.club_id, 'Kolam Tetap');
  insert into class_types (club_id, name) values (v_club, 'Dasar');
  insert into membership_packages (club_id, name, price, billing_period) values (v_club, 'Bulanan', 100000, 'monthly') returning id into v_pkg;
  insert into club_members (club_id, full_name, date_of_birth) values (v_club, 'Murid Satu', '2015-01-01') returning id into v_member;
  insert into club_members (club_id, full_name, date_of_birth) values (k.club_id, 'Murid Tetap', '2015-01-01');
  insert into member_memberships (club_id, member_id, package_id, status, start_date, end_date)
  values (v_club, v_member, v_pkg, 'active', current_date, current_date + 30) returning id into v_sub;
  insert into invoices (club_id, member_id, subscription_id, amount, status, due_date, period_start, period_end)
  values (v_club, v_member, v_sub, 100000, 'paid', current_date, current_date, current_date + 30);
  insert into products (club_id, name, price) values (v_club, 'Kacamata', 50000);
  insert into cash_ledger (club_id, category, direction, amount, reason, created_by) values (v_club, 'manual_adjustment', 'in', 1000, 'koreksi', r.profile_id);

  res := purge_organization(v_org);
  assert (res ->> 'dry_run')::boolean, 'default is a dry run';
  assert (res -> 'counts' ->> 'club_members')::int = 1 and (res -> 'counts' ->> 'invoices')::int = 1 and (res -> 'counts' ->> 'clubs')::int = 1, 'dry run counts rows';
  assert (res -> 'counts' ->> 'organization_users')::int = 2, 'dry run counts the owners';
  assert (select count(*) from club_members where club_id = v_club) = 1, 'dry run deletes nothing';
  assert (select count(*) from purge_candidates()) = 0, 'a fresh organization is no candidate';

  begin
    perform purge_organization(v_org, true);
    assert false, 'real purge needs an eligible organization';
  exception when sqlstate 'PG002' then null; end;

  begin
    perform request_organization_deletion(v_org, akeep);
    assert false, 'only the main owner can request deletion';
  exception when sqlstate 'OW001' then null; end;
  begin
    perform request_organization_deletion(v_org, aco);
    assert false, 'a co-owner cannot request deletion';
  exception when sqlstate 'OW001' then null; end;

  v_after := request_organization_deletion(v_org, aown);
  assert v_after > now() + interval '29 days' and v_after < now() + interval '31 days', 'thirty day wait';
  assert (select status from organization_subscriptions where organization_id = v_org) = 'cancelled', 'subscription is cancelled';
  assert not exists (select 1 from clubs where organization_id = v_org and is_active), 'every club is switched off';
  assert (select deletion_previous_status from organizations where id = v_org) = 'trial', 'previous status remembered';
  begin
    perform request_organization_deletion(v_org, aown);
    assert false, 'cannot request twice';
  exception when sqlstate 'DL001' then null; end;
  assert (select count(*) from purge_candidates()) = 0, 'not a candidate during the wait';

  perform cancel_organization_deletion(v_org, aown);
  assert (select status from organization_subscriptions where organization_id = v_org) = 'trial', 'restored to the previous status';
  assert exists (select 1 from clubs where organization_id = v_org and is_active), 'clubs are back';
  assert (select deletion_requested_at from organizations where id = v_org) is null, 'deletion cleared';
  begin
    perform cancel_organization_deletion(v_org, aown);
    assert false, 'nothing left to cancel';
  exception when sqlstate 'DL002' then null; end;

  perform request_organization_deletion(v_org, aown);
  update organizations set deletion_requested_at = now() - interval '31 days', purge_after = now() - interval '1 day' where id = v_org;
  assert (select count(*) from purge_candidates() where organization_id = v_org and reason = 'owner_deleted') = 1, 'candidate after the wait';
  begin
    perform cancel_organization_deletion(v_org, aown);
    assert false, 'too late to cancel';
  exception when sqlstate 'DL002' then null; end;

  begin
    perform purge_organization(v_org, true);
    assert false, 'purge stays off until the flag is on';
  exception when sqlstate 'PG002' then null; end;

  update platform_flags set enabled = true where key = 'purge_enabled';
  res := purge_organization(v_org, true);
  assert not (res ->> 'dry_run')::boolean, 'real run reported';
  assert not exists (select 1 from organizations where id = v_org), 'organization removed';
  assert not exists (select 1 from clubs where id = v_club), 'club removed';
  assert (select count(*) from club_members where club_id = v_club) = 0, 'members removed';
  assert (select count(*) from organization_purges where organization_id = v_org and reason = 'owner_deleted') = 1, 'purge recorded';
  assert (select counts ->> 'club_members' from organization_purges where organization_id = v_org) = '1', 'with counts';
  assert exists (select 1 from accounts where id = aown), 'accounts are kept';
  assert exists (select 1 from organizations where id = k.organization_id), 'other organizations are untouched';
  assert (select count(*) from club_members where club_id = k.club_id) = 1, 'other clubs keep their members';
  assert (select count(*) from locations where club_id = k.club_id) = 1, 'and their locations';

  update organization_subscriptions set status = 'expired', current_period_end = current_date - 400, current_period_start = current_date - 430 where organization_id = k.organization_id;
  assert (select count(*) from purge_candidates() where organization_id = k.organization_id and reason = 'grace_expired') = 1, 'expired beyond the grace period is a candidate';
  update organization_subscriptions set current_period_end = current_date - 100 where organization_id = k.organization_id;
  assert (select count(*) from purge_candidates()) = 0, 'inside the grace period it is not';
end;
$$;

rollback;
