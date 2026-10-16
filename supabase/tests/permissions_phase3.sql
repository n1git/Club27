\set ON_ERROR_STOP on
begin;

create function pg_temp.act(p_profile uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_profile, 'role', 'authenticated', 'tenant_id', (select tenant_id from profiles where id = p_profile),
    'account_id', (select account_id from profiles where id = p_profile), 'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.act(uuid) to public;

insert into accounts (email, full_name, password_hash) values
  ('p@t.test', 'P', 'h'), ('rec@t.test', 'Rec', 'h'), ('coach@t.test', 'Coach', 'h'),
  ('custom@t.test', 'Custom', 'h'), ('q@t.test', 'Q', 'h'), ('mem@t.test', 'Mem', 'h');

create table pg_temp.ctx as select 1 as x where false;

do $$
declare
  ap uuid; arec uuid; acoach uuid; acustom uuid; aq uuid; amem uuid;
  r1 record; r2 record;
  p_owner uuid; p_rec uuid; p_coach uuid; p_custom uuid; p_q uuid;
  role_rec uuid; role_coach uuid; role_head uuid; role_custom uuid; role_admin uuid; role_other uuid;
  m_rec uuid; v_member uuid; n int;
begin
  select id into ap from accounts where email = 'p@t.test';
  select id into arec from accounts where email = 'rec@t.test';
  select id into acoach from accounts where email = 'coach@t.test';
  select id into acustom from accounts where email = 'custom@t.test';
  select id into aq from accounts where email = 'q@t.test';
  select id into amem from accounts where email = 'mem@t.test';

  select * into r1 from register_organization('Org P', 'Club P', ap, 'standard', 'monthly', 'swimming');
  select * into r2 from register_organization('Org Q', 'Club Q', aq, 'standard', 'monthly', 'swimming');
  p_owner := r1.profile_id;

  assert (select count(*) from organization_roles where organization_id = r1.organization_id) = 6, 'six preset roles per organization';
  assert not exists (
    select 1 from role_permissions rp join permissions p on p.code = rp.permission_code where p.owner_only
  ), 'no role holds an owner-only permission';

  select id into role_admin from organization_roles where organization_id = r1.organization_id and preset_key = 'admin';
  select id into role_rec from organization_roles where organization_id = r1.organization_id and preset_key = 'resepsionis';
  select id into role_coach from organization_roles where organization_id = r1.organization_id and preset_key = 'pelatih';
  select id into role_head from organization_roles where organization_id = r1.organization_id and preset_key = 'kepala_pelatih';
  select id into role_other from organization_roles where organization_id = r2.organization_id and preset_key = 'admin';

  begin
    insert into role_permissions (role_id, permission_code) values (role_admin, 'roles.manage');
    assert false, 'owner-only permission must not be grantable to a role';
  exception when check_violation then null; end;

  assert (select count(*) from role_permissions where role_id = role_admin) > 25, 'admin preset is broad';
  assert not exists (select 1 from role_permissions where role_id = role_admin and permission_code = 'classes.instruct'), 'admin preset is not an instructor';

  begin
    insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
    values (r1.tenant_id, 'staff', role_rec, 'Rec', 'rec@t.test', arec);
    assert false, 'a paid role needs a staff membership with a club assignment';
  exception when check_violation then null; end;

  insert into organization_members (organization_id, account_id, email, full_name, base_role)
  values (r1.organization_id, arec, 'rec@t.test', 'Rec', 'staff') returning id into m_rec;

  begin
    insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
    values (r1.tenant_id, 'staff', role_rec, 'Rec', 'rec@t.test', arec);
    assert false, 'membership without a club assignment is not enough';
  exception when check_violation then null; end;

  insert into organization_member_clubs (member_id, tenant_id) values (m_rec, r1.tenant_id);
  insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
  values (r1.tenant_id, 'staff', role_rec, 'Rec', 'rec@t.test', arec) returning id into p_rec;

  begin
    insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
    values (r1.tenant_id, 'staff', role_other, 'Q', 'q@t.test', aq);
    assert false, 'a role of another organization cannot be assigned';
  exception when check_violation or raise_exception then null; end;

  insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
  values (r1.tenant_id, 'staff', role_coach, 'Coach', 'coach@t.test', acoach) returning id into p_coach;

  assert is_instructor(p_coach), 'coach role is an instructor';
  assert not is_instructor(p_rec), 'receptionist is not an instructor';
  assert not is_instructor(p_owner), 'owner profile is not an instructor';
  assert not exists (select 1 from members where profile_id = p_coach), 'coach has no members row';

  insert into locations (tenant_id, name) values (r1.tenant_id, 'L');
  insert into class_types (tenant_id, name) values (r1.tenant_id, 'T');
  insert into classes (tenant_id, instructor_id, location_id, class_type_id, start_time, end_time)
  values (r1.tenant_id, p_coach, (select id from locations where tenant_id = r1.tenant_id), (select id from class_types where tenant_id = r1.tenant_id), now() + interval '2 days', now() + interval '2 days 1 hour');

  begin
    insert into classes (tenant_id, instructor_id, location_id, class_type_id, start_time, end_time)
    values (r1.tenant_id, p_rec, (select id from locations where tenant_id = r1.tenant_id), (select id from class_types where tenant_id = r1.tenant_id), now() + interval '3 days', now() + interval '3 days 1 hour');
    assert false, 'a non-instructor cannot teach a class';
  exception when raise_exception then null; end;

  perform pg_temp.act(p_owner);
  assert has_permission('roles.manage') and has_permission('members.delete') and has_permission('audit.view'), 'owner holds every permission';
  assert array_length(profile_permissions(p_owner), 1) = (select count(*) from permissions), 'owner permission list is the whole catalog';

  perform pg_temp.act(p_rec);
  assert has_permission('members.view_all') and has_permission('pos.sell'), 'receptionist permissions';
  assert not has_permission('cash_ledger.view') and not has_permission('roles.manage'), 'receptionist lacks finance and owner permissions';
  assert (select array_agg(c order by c) from unnest(profile_permissions(p_rec)) c) = (select array_agg(permission_code order by permission_code) from role_permissions where role_id = role_rec), 'profile_permissions mirrors the role';

  perform pg_temp.act(p_coach);
  assert has_permission('members.view_assigned') and not has_permission('members.view_all'), 'coach is limited to assigned members';
  assert is_member() is false, 'coach is not a member';

  set constraints all immediate;
  update organization_members set is_active = false where id = m_rec;
  perform pg_temp.act(p_rec);
  assert not has_permission('members.view_all'), 'deactivating the staff membership cuts a paid role at once';
  assert profile_permissions(p_rec) = '{}', 'and the permission list is empty';
  update organization_members set is_active = true where id = m_rec;
  perform pg_temp.act(p_rec);
  assert has_permission('members.view_all'), 'reactivation restores it';
  delete from organization_member_clubs where member_id = m_rec;
  assert not has_permission('members.view_all'), 'removing the club assignment cuts a paid role at once';
  insert into organization_member_clubs (member_id, tenant_id) values (m_rec, r1.tenant_id);

  delete from role_permissions where role_id = role_rec and permission_code = 'members.view_all';
  assert not has_permission('members.view_all'), 'revoking a permission applies at once';
  assert has_permission('members.create'), 'other permissions stay';

  perform set_config('request.jwt.claims', '', true);
  insert into organization_roles (organization_id, name, is_paid) values (r1.organization_id, 'Penjaga Loket', false) returning id into role_custom;
  insert into role_permissions (role_id, permission_code) values (role_custom, 'checkin.view_all'), (role_custom, 'members.lookup');
  insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
  values (r1.tenant_id, 'staff', role_custom, 'Custom', 'custom@t.test', acustom) returning id into p_custom;
  perform pg_temp.act(p_custom);
  assert has_permission('checkin.view_all') and has_permission('members.lookup'), 'custom role permissions';
  assert not has_permission('members.view_all'), 'custom role stays limited';

  perform set_config('request.jwt.claims', '', true);
  update organization_members set is_active = false where organization_id = r1.organization_id and account_id = ap;
  perform pg_temp.act(p_owner);
  assert not has_permission('members.delete'), 'an inactive owner membership cuts every owner permission';
  update organization_members set is_active = true where organization_id = r1.organization_id and account_id = ap;

  p_q := r2.profile_id;
  perform pg_temp.act(p_q);
  assert has_permission('roles.manage'), 'the other organization owner holds its permissions';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_q, 'role', 'authenticated', 'tenant_id', r1.tenant_id, 'account_id', aq, 'iat', extract(epoch from now())::bigint)::text, true);
  assert not has_permission('members.view_all') and not is_active_user(), 'a token for another organization club grants nothing';
end $$;

set local role authenticated;

do $$
begin
  begin perform 1 from permissions; assert false, 'permissions closed'; exception when insufficient_privilege then null; end;
  begin perform 1 from organization_roles; assert false, 'roles closed'; exception when insufficient_privilege then null; end;
  begin perform 1 from role_permissions; assert false, 'role_permissions closed'; exception when insufficient_privilege then null; end;
  begin perform profile_permissions(gen_random_uuid()); assert false, 'profile_permissions is server only'; exception when insufficient_privilege then null; end;
  begin perform seed_organization_roles(gen_random_uuid()); assert false, 'seed is server only'; exception when insufficient_privilege then null; end;
end $$;

rollback;
