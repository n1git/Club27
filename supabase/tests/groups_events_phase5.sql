\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('ga@t.test', 'guser.a', 'Ga', 'h'), ('gb@t.test', 'guser.b', 'Gb', 'h'),
  ('gc@t.test', 'guser.c', 'Gc', 'h'), ('gd@t.test', 'guser.d', 'Gd', 'h');

create function pg_temp.uid(p_email text) returns uuid language sql security definer as $f$
  select id from accounts where email = p_email
$f$;
grant execute on function pg_temp.uid(text) to public;

create function pg_temp.act(p_email text) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', pg_temp.uid(p_email), 'role', 'authenticated', 'club_id', '', 'account_id', pg_temp.uid(p_email),
    'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.act(text) to public;

insert into friendships (requester_id, addressee_id, status) values
  (pg_temp.uid('ga@t.test'), pg_temp.uid('gb@t.test'), 'accepted'),
  (pg_temp.uid('ga@t.test'), pg_temp.uid('gc@t.test'), 'accepted');

set local role authenticated;

do $$
declare
  g uuid; ev uuid; ev2 uuid; n int;
  soon timestamptz := now() + interval '3 days';
begin
  perform pg_temp.act('ga@t.test');
  begin perform create_group('ab', null); assert false, 'name length'; exception when check_violation then null; end;
  g := create_group('  Komunitas Renang  ', 'Latihan bareng');
  assert (select name from groups where id = g) = 'Komunitas Renang', 'name trimmed';
  assert (select count(*) from group_members where group_id = g and role = 'owner' and status = 'active') = 1, 'owner is a member';

  begin perform invite_to_group(g, pg_temp.uid('gd@t.test')); assert false, 'only friends'; exception when sqlstate 'GR002' then null; end;
  perform invite_to_group(g, pg_temp.uid('gb@t.test'));
  begin perform invite_to_group(g, pg_temp.uid('gb@t.test')); assert false, 'duplicate invite'; exception when sqlstate 'GR003' then null; end;

  perform pg_temp.act('gb@t.test');
  assert (select count(*) from groups) = 1, 'invitee sees the group';
  assert (select count(*) from group_members) = 1, 'invitee sees only own membership row';
  assert (select count(*) from social_people where username = 'guser.a') = 1, 'invitee sees the owner name';
  begin perform invite_to_group(g, pg_temp.uid('gc@t.test')); assert false, 'invitee cannot invite'; exception when sqlstate '42501' then null; end;
  begin perform create_event(g, 'Event Uji', null, null, soon, null, null); assert false, 'invitee cannot create events'; exception when sqlstate '42501' then null; end;
  perform respond_group_invite(g, true);
  assert (select count(*) from group_members) = 2, 'member sees all members';
  begin perform respond_group_invite(g, true); assert false, 'invite is consumed'; exception when sqlstate 'GR004' then null; end;

  perform pg_temp.act('gd@t.test');
  assert (select count(*) from groups) = 0 and (select count(*) from group_members) = 0 and (select count(*) from events) = 0, 'strangers see nothing';
  assert (select count(*) from social_people) = 1, 'strangers see no group peers';

  perform pg_temp.act('gb@t.test');
  begin perform create_event(g, 'Event Uji', null, null, now() - interval '1 hour', null, null); assert false, 'past start'; exception when sqlstate 'EV001' then null; end;
  begin perform create_event(g, 'Ev', null, null, soon, null, null); assert false, 'title length'; exception when check_violation then null; end;
  begin perform create_event(g, 'Event Uji', null, null, soon, soon - interval '1 hour', null); assert false, 'end before start'; exception when check_violation then null; end;
  ev := create_event(g, 'Latihan Pagi', 'bawa kacamata', 'Kolam A', soon, soon + interval '2 hours', 2);
  assert (select status from event_rsvps where event_id = ev and account_id = pg_temp.uid('gb@t.test')) = 'going', 'creator goes';

  perform pg_temp.act('ga@t.test');
  perform invite_to_group(g, pg_temp.uid('gc@t.test'));
  perform rsvp_event(ev, 'going');
  assert (select count(*) from event_rsvps where event_id = ev and status = 'going') = 2, 'owner goes';

  perform pg_temp.act('gc@t.test');
  assert (select count(*) from events) = 0, 'invitee sees no events yet';
  perform respond_group_invite(g, true);
  assert (select count(*) from events) = 1, 'member sees events';
  begin perform rsvp_event(ev, 'going'); assert false, 'capacity'; exception when sqlstate 'EV004' then null; end;
  perform rsvp_event(ev, 'maybe');
  begin perform rsvp_event(ev, 'perhaps'); assert false, 'status'; exception when sqlstate 'EV002' then null; end;
  perform pg_temp.act('ga@t.test');
  perform rsvp_event(ev, 'declined');
  perform pg_temp.act('gc@t.test');
  perform rsvp_event(ev, 'going');
  assert (select status from event_rsvps where event_id = ev and account_id = pg_temp.uid('gc@t.test')) = 'going', 'freed seat taken';

  perform pg_temp.act('gd@t.test');
  begin perform rsvp_event(ev, 'going'); assert false, 'outsider rsvp'; exception when sqlstate '42501' then null; end;
  begin perform cancel_event(ev); assert false, 'outsider cancel'; exception when sqlstate '42501' then null; end;
  begin perform leave_group(g); end;

  perform pg_temp.act('gc@t.test');
  begin perform cancel_event(ev); assert false, 'neither creator nor owner'; exception when sqlstate '42501' then null; end;

  perform pg_temp.act('ga@t.test');
  ev2 := create_event(g, 'Event Dua', null, null, soon, null, null);
  perform cancel_event(ev2);
  assert (select cancelled_at is not null from events where id = ev2), 'owner cancels';
  begin perform rsvp_event(ev2, 'going'); assert false, 'cancelled event'; exception when sqlstate 'EV003' then null; end;
  begin perform leave_group(g); assert false, 'owner cannot leave'; exception when sqlstate 'GR005' then null; end;

  perform pg_temp.act('gc@t.test');
  perform leave_group(g);
  assert (select count(*) from groups) = 0 and (select count(*) from event_rsvps) = 0, 'leaver loses access';
  perform pg_temp.act('gb@t.test');
  assert (select count(*) from event_rsvps where account_id = pg_temp.uid('gc@t.test')) = 0, 'leaver rsvps removed';
  begin perform remove_group_member(g, pg_temp.uid('ga@t.test')); assert false, 'member cannot remove'; exception when sqlstate '42501' then null; end;
  begin perform delete_group(g); assert false, 'member cannot delete'; exception when sqlstate '42501' then null; end;

  begin insert into groups (name) values ('Langsung'); assert false, 'direct insert'; exception when insufficient_privilege then null; end;
  begin insert into events (group_id, created_by, title, starts_at) values (g, pg_temp.uid('gb@t.test'), 'Langsung', soon); assert false, 'direct event'; exception when insufficient_privilege then null; end;
  insert into reports (target_type, target_id, reason) values ('group', g, 'konten tidak pantas');
  insert into reports (target_type, target_id, reason) values ('event', ev, 'konten tidak pantas');

  perform pg_temp.act('ga@t.test');
  perform remove_group_member(g, pg_temp.uid('gb@t.test'));
  assert (select count(*) from group_members where group_id = g) = 1, 'owner removes a member';
  perform delete_group(g);
  assert (select count(*) from groups) = 0, 'owner deletes the group';
end $$;

reset role;
do $$ begin
  assert (select count(*) from events) = 0 and (select count(*) from event_rsvps) = 0 and (select count(*) from group_members) = 0, 'deleting a group cascades';
end $$;

insert into friendships (requester_id, addressee_id, status) values (pg_temp.uid('ga@t.test'), pg_temp.uid('gd@t.test'), 'accepted') on conflict do nothing;
set local role authenticated;
do $$
declare
  g uuid; ev uuid;
  soon timestamptz := now() + interval '3 days';
begin
  perform pg_temp.act('ga@t.test');
  g := create_group('Grup Blokir', null);
  perform invite_to_group(g, pg_temp.uid('gb@t.test'));
  perform invite_to_group(g, pg_temp.uid('gd@t.test'));
  perform pg_temp.act('gb@t.test');
  perform respond_group_invite(g, true);
  perform pg_temp.act('gd@t.test');
  perform respond_group_invite(g, true);
  ev := create_event(g, 'Event Blokir', null, null, soon, null, null);
  perform pg_temp.act('gb@t.test');
  perform rsvp_event(ev, 'going');
  perform block_account(pg_temp.uid('ga@t.test'));
  assert (select count(*) from groups) = 0 and (select count(*) from event_rsvps) = 0, 'blocking the owner removes the blocker from the group';
  perform pg_temp.act('ga@t.test');
  assert (select count(*) from group_members where group_id = g) = 2, 'the owner keeps the others';
  assert (select count(*) from event_rsvps where account_id = pg_temp.uid('gb@t.test')) = 0, 'the blocker rsvp is gone';
  perform block_account(pg_temp.uid('gd@t.test'));
  assert (select count(*) from group_members where group_id = g) = 1, 'the owner blocking a member removes them';
  assert (select count(*) from groups where id = g) = 1, 'the group survives';
end $$;
reset role;

delete from accounts where email in ('ga@t.test', 'gb@t.test', 'gc@t.test', 'gd@t.test');
rollback;
\echo groups_events_phase5 OK
