\set ON_ERROR_STOP on
begin;

insert into accounts (email, full_name, password_hash) values
  ('p1@t.test', 'P One', 'h'), ('o2@t.test', 'O Two', 'h'), ('s1@t.test', 'S One', 'h');

do $$
declare
  a1 uuid; a2 uuid; a3 uuid; r1 record; r2 record; r3 record; m_owner uuid; m_staff uuid; t2 uuid;
begin
  select id into a1 from accounts where email = 'p1@t.test';
  select id into a2 from accounts where email = 'o2@t.test';
  select id into a3 from accounts where email = 's1@t.test';

  select * into r1 from register_organization('Org One', 'Club One', a1, 'plus', 'monthly', 'swimming');
  assert (select base_role from organization_users where id = r1.owner_id) = 'p_owner', 'registrant is the p_owner';

  select * into r2 from register_organization('Org Two', 'Club Two', a1, 'plus', 'monthly', 'gym');
  update organization_subscriptions set seats = 50;
  assert (select count(*) from organization_users where account_id = a1 and base_role = 'p_owner') = 2, 'one account can be p_owner of two organizations';

  begin
    insert into organization_users (organization_id, account_id, email, full_name, base_role)
    values (r1.organization_id, a2, 'o2@t.test', 'O Two', 'p_owner');
    set constraints all immediate;
    assert false, 'a second p_owner in one organization must fail';
  exception when unique_violation then null; end;

  insert into organization_users (organization_id, account_id, email, full_name, base_role)
  values (r1.organization_id, a2, 'o2@t.test', 'O Two', 'owner') returning id into m_owner;

  begin
    insert into organization_users (organization_id, account_id, email, full_name, base_role)
    values (r1.organization_id, a2, 'o2@t.test', 'O Two', 'staff');
    assert false, 'one membership per account and organization';
  exception when unique_violation then null; end;

  insert into organization_users (organization_id, account_id, email, full_name, base_role)
  values (r1.organization_id, a3, 's1@t.test', 'S One', 'staff') returning id into m_staff;

  begin
    update organization_users set base_role = 'owner' where id = r1.owner_id;
    set constraints all immediate;
    assert false, 'demoting the only p_owner must fail';
  exception when check_violation then null; end;
  set constraints all deferred;

  begin
    delete from organization_users where id = r1.owner_id;
    set constraints all immediate;
    assert false, 'deleting the only p_owner of a live organization must fail';
  exception when check_violation or foreign_key_violation then null; end;
  set constraints all deferred;

  update organization_users set base_role = 'owner' where id = r1.owner_id;
  update organization_users set base_role = 'p_owner' where id = m_owner;
  set constraints all immediate;
  assert (select base_role from organization_users where id = m_owner) = 'p_owner', 'ownership can move inside one transaction';
  set constraints all deferred;

  insert into organization_user_clubs (member_id, club_id) values (m_staff, r1.club_id);

  begin
    insert into organization_user_clubs (member_id, club_id) values (m_staff, r2.club_id);
    assert false, 'staff cannot be assigned to a club of another organization';
  exception when raise_exception then null; end;

  begin
    insert into organization_user_clubs (member_id, club_id) values (m_owner, r1.club_id);
    assert false, 'only staff are assigned to clubs';
  exception when raise_exception then null; end;

  assert (select count(*) from organization_user_clubs where member_id = m_staff) = 1, 'assignment stored';
end $$;

set local role authenticated;

do $$
begin
  begin
    perform 1 from organization_users;
    assert false, 'organization_members must not be readable by clients';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from organization_user_clubs;
    assert false, 'organization_member_clubs must not be readable by clients';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
