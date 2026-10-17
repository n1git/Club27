\set ON_ERROR_STOP on
begin;

insert into accounts (email, full_name, password_hash) values
  ('own@t.test', 'Own', 'h'), ('rec@t.test', 'Rec', 'h'), ('kasir@t.test', 'Kasir', 'h'),
  ('co@t.test', 'Co', 'h'), ('other@t.test', 'Other', 'h');

do $$
declare
  aown uuid; arec uuid; akasir uuid; aco uuid; aother uuid;
  r record; acc record; inv uuid; v_org uuid; v_club uuid; v_new uuid;
  role_rec uuid; role_kasir uuid; m_co uuid; m_own uuid; n int;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select id into aown from accounts where email = 'own@t.test';
  select id into arec from accounts where email = 'rec@t.test';
  select id into akasir from accounts where email = 'kasir@t.test';
  select id into aco from accounts where email = 'co@t.test';
  select id into aother from accounts where email = 'other@t.test';

  select * into r from register_organization('Org I', 'Club I', aown, 'standard', 'monthly', 'swimming');
  update organization_subscriptions set seats = 10;
  v_org := r.organization_id; v_club := r.club_id;
  select id into role_rec from organization_roles where organization_id = v_org and preset_key = 'resepsionis';
  select id into role_kasir from organization_roles where organization_id = v_org and preset_key = 'kasir';

  inv := create_invitation(v_org, v_club, 'staff', role_rec, 'Rec@T.test', 'Rec', 'hash-1', aown);
  assert (select email from invitations where id = inv) = 'rec@t.test', 'email is normalised';
  assert (select expires_at from invitations where id = inv) > now() + interval '6 days', 'seven day expiry';
  perform create_invitation(v_org, v_club, 'staff', role_rec, 'rec@t.test', 'Rec', 'hash-2', aown);
  assert (select status from invitations where id = inv) = 'revoked', 'a new invitation supersedes the pending one';
  assert (select count(*) from accept_invitation('hash-1', arec)) = 0, 'a revoked token does nothing';

  begin
    perform accept_invitation('hash-2', aother);
    assert false, 'another account cannot take the invitation';
  exception when sqlstate 'IV002' then null; end;
  assert (select status from invitations where token_hash = 'hash-2') = 'pending', 'a refused accept leaves it pending';

  select * into acc from accept_invitation('hash-2', arec);
  assert acc.out_kind = 'staff' and acc.out_club_id = v_club and acc.out_profile_id is not null, 'accept returns the profile';
  assert (select count(*) from club_profiles where account_id = arec and club_id = v_club and role = 'staff' and org_role_id = role_rec) = 1, 'staff profile created';
  assert (select count(*) from organization_users where account_id = arec and base_role = 'staff' and is_active) = 1, 'a paid role takes a seat';
  assert (select count(*) from organization_user_clubs c join organization_users m on m.id = c.member_id where m.account_id = arec and c.club_id = v_club) = 1, 'and a club assignment';
  assert (select count(*) from accept_invitation('hash-2', arec)) = 0, 'a token works once';
  assert (select status from invitations where token_hash = 'hash-2') = 'accepted', 'marked accepted';

  begin
    perform create_invitation(v_org, v_club, 'staff', role_rec, 'rec@t.test', 'Rec', 'hash-3', aown);
    assert false, 'already linked email is refused';
  exception when sqlstate 'IV001' then null; end;

  perform create_invitation(v_org, v_club, 'staff', role_kasir, 'kasir@t.test', 'Kasir', 'hash-4', aown);
  update invitations set expires_at = now() - interval '1 minute' where token_hash = 'hash-4';
  assert (select count(*) from accept_invitation('hash-4', akasir)) = 0, 'an expired token does nothing';
  perform create_invitation(v_org, v_club, 'staff', role_kasir, 'kasir@t.test', 'Kasir', 'hash-5', aown);
  perform accept_invitation('hash-5', akasir);
  assert (select count(*) from organization_users where account_id = akasir) = 0, 'a free role takes no seat';
  assert (select count(*) from club_profiles where account_id = akasir and role = 'staff') = 1, 'free staff profile exists';

  begin
    perform create_invitation(v_org, v_club, 'owner', role_rec, 'co@t.test', 'Co', 'hash-x', aown);
    assert false, 'owner invitations carry no role';
  exception when sqlstate '22023' then null; end;

  perform create_invitation(v_org, null, 'owner', null, 'co@t.test', 'Co', 'hash-6', aown);
  select * into acc from accept_invitation('hash-6', aco);
  assert acc.out_kind = 'owner' and acc.out_club_id is null, 'owner invitation accepted';
  select id into m_co from organization_users where account_id = aco;
  select id into m_own from organization_users where account_id = aown;
  assert (select base_role from organization_users where id = m_co) = 'owner', 'co-owner member';
  assert (select count(*) from club_profiles where owner_id = m_co and club_id = v_club and role = 'owner') = 1, 'co-owner profile in every club';

  select club_id into v_new from create_club_for_owner(m_own, 'Club I2', 'swimming');
  assert (select count(*) from club_profiles where club_id = v_new and role = 'owner') = 2, 'a new club gives every owner a profile';

  begin
    perform transfer_ownership(v_org, m_co, aco);
    assert false, 'only the main owner can transfer';
  exception when sqlstate 'OW001' then null; end;
  begin
    perform transfer_ownership(v_org, (select id from organization_users where account_id = arec), aown);
    assert false, 'the target must be an owner';
  exception when sqlstate 'OW002' then null; end;
  perform transfer_ownership(v_org, m_co, aown);
  set constraints all immediate;
  assert (select base_role from organization_users where id = m_co) = 'p_owner', 'target is now the main owner';
  assert (select base_role from organization_users where id = m_own) = 'owner', 'previous main owner stays an owner';
  assert (select count(*) from organization_users where organization_id = v_org and base_role = 'p_owner') = 1, 'exactly one main owner';

  insert into password_resets (account_id, token_hash, expires_at, delivered) values (arec, 'rs-1', now() + interval '1 hour', true);
  insert into password_resets (account_id, token_hash, expires_at, delivered) values (arec, 'rs-2', now() + interval '1 hour', true);
  insert into password_resets (account_id, token_hash, expires_at) values (aother, 'rs-old', now() - interval '1 minute');
  assert (select count(*) from consume_password_reset('rs-old', 'new')) = 0, 'an expired reset does nothing';
  select * into acc from consume_password_reset('rs-1', 'newhash');
  assert acc.out_account_id = arec, 'reset returns the account';
  assert (select password_hash from accounts where id = arec) = 'newhash', 'password replaced';
  assert (select email_verified_at is not null from accounts where id = arec), 'a delivered reset verifies the email';
  assert (select sessions_valid_after is not null from accounts where id = arec), 'old sessions are revoked';
  assert (select count(*) from consume_password_reset('rs-1', 'again')) = 0, 'a reset works once';
  assert (select count(*) from consume_password_reset('rs-2', 'again')) = 0, 'other pending resets are cancelled';

  insert into password_resets (account_id, token_hash, expires_at, delivered) values (aother, 'rs-3', now() + interval '1 hour', false);
  perform consume_password_reset('rs-3', 'h2');
  assert (select email_verified_at is null from accounts where id = aother), 'a link not sent by email does not verify the email';

  update organization_subscriptions set status = 'active', current_period_start = v_today - 60, current_period_end = v_today - 5 where organization_id = v_org;
  begin
    perform create_invitation(v_org, v_club, 'staff', role_kasir, 'late@t.test', 'Late', 'hash-7', aown);
    assert false, 'invitations are blocked in the grace period';
  exception when sqlstate 'SW003' then null; end;
end;
$$;

rollback;
