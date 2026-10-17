\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('fa@t.test', 'fuser.a', 'Fa', 'h'), ('fb@t.test', 'fuser.b', 'Fb', 'h'),
  ('fc@t.test', 'fuser.c', 'Fc', 'h'), ('fd@t.test', 'fuser.d', 'Fd', 'h');

create function pg_temp.act(p_email text) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select id from accounts where email = p_email), 'role', 'authenticated', 'club_id', '',
    'account_id', (select id from accounts where email = p_email), 'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.act(text) to public;

create function pg_temp.uid(p_email text) returns uuid language sql security definer as $f$
  select id from accounts where email = p_email
$f$;
grant execute on function pg_temp.uid(text) to public;

set local role authenticated;

do $$
declare
  fid uuid; pid uuid; cid uuid; wid uuid; r text; n int;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  perform pg_temp.act('fa@t.test');
  begin perform request_friend('fuser.a'); assert false, 'self'; exception when sqlstate 'FR002' then null; end;
  begin perform request_friend('nobody'); assert false, 'unknown'; exception when sqlstate 'FR001' then null; end;
  assert request_friend('FUSER.B') = 'requested', 'request is case-insensitive';
  begin perform request_friend('fuser.b'); assert false, 'duplicate'; exception when sqlstate 'FR003' then null; end;
  assert (select count(*) from friendships) = 1, 'requester sees the request';
  assert (select count(*) from social_people where username = 'fuser.b') = 1, 'pending counterpart is visible by name';

  perform pg_temp.act('fc@t.test');
  assert (select count(*) from friendships) = 0, 'strangers see no friendships';
  assert (select count(*) from social_people) = 1, 'strangers see only themselves';

  perform pg_temp.act('fb@t.test');
  select id into fid from friendships;
  begin perform respond_friend(gen_random_uuid(), true); assert false, 'unknown request'; exception when sqlstate 'FR001' then null; end;
  perform pg_temp.act('fa@t.test');
  begin perform respond_friend(fid, true); assert false, 'requester cannot accept own request'; exception when sqlstate 'FR001' then null; end;
  perform pg_temp.act('fb@t.test');
  perform respond_friend(fid, true);
  assert (select status from friendships) = 'accepted', 'accepted';
  assert is_friend_of(pg_temp.uid('fa@t.test')), 'friends';

  perform pg_temp.act('fb@t.test');
  perform request_friend('fuser.c');
  perform pg_temp.act('fc@t.test');
  assert request_friend('fuser.b') = 'accepted', 'a mutual request accepts';
  perform pg_temp.act('fd@t.test');
  perform request_friend('fuser.c');
  perform pg_temp.act('fc@t.test');
  perform respond_friend((select id from friendships where requester_id = pg_temp.uid('fd@t.test')), false);
  assert (select count(*) from friendships where requester_id = pg_temp.uid('fd@t.test')) = 0, 'decline removes it';

  perform pg_temp.act('fa@t.test');
  pid := create_post('  halo teman  ');
  assert (select body from posts where id = pid) = 'halo teman', 'body trimmed';
  begin perform create_post('   '); assert false, 'empty post'; exception when check_violation then null; end;
  begin perform create_post(repeat('x', 2001)); assert false, 'long post'; exception when check_violation then null; end;

  perform pg_temp.act('fb@t.test');
  assert (select count(*) from posts) = 1, 'a friend sees the post';
  perform pg_temp.act('fc@t.test');
  assert (select count(*) from posts) = 0, 'a friend of a friend does not';
  begin insert into post_comments (post_id, body) values (pid, 'x'); assert false, 'stranger cannot comment'; exception when insufficient_privilege or sqlstate '42501' then null; end;
  begin insert into post_reactions (post_id) values (pid); assert false, 'stranger cannot react'; exception when insufficient_privilege or sqlstate '42501' then null; end;
  assert (select count(*) from post_comments) = 0 and (select count(*) from post_reactions) = 0, 'stranger sees no engagement';

  perform pg_temp.act('fb@t.test');
  insert into post_reactions (post_id) values (pid);
  begin insert into post_reactions (post_id) values (pid); assert false, 'one reaction'; exception when unique_violation then null; end;
  insert into post_comments (post_id, body) values (pid, 'mantap') returning id into cid;
  begin insert into post_comments (post_id, body) values (pid, ''); assert false, 'empty comment'; exception when check_violation then null; end;
  begin insert into post_comments (post_id, body, account_id) values (pid, 'x', pg_temp.uid('fa@t.test')); assert false, 'cannot comment as another'; exception when insufficient_privilege or sqlstate '42501' then null; end;

  perform pg_temp.act('fa@t.test');
  assert (select count(*) from post_comments) = 1 and (select count(*) from post_reactions) = 1, 'author sees engagement';
  assert (select count(*) from social_people where username = 'fuser.b') = 1, 'commenter name visible';
  begin delete from posts where id = pid and false; end;

  insert into workout_logs (sport, performed_on, duration_min, distance_m, notes) values ('swimming', today, 40, 1200, 'rahasia') returning id into wid;
  perform share_workout(wid, 'hari ini');
  perform pg_temp.act('fb@t.test');
  assert (select count(*) from posts where kind = 'workout' and sport = 'swimming' and duration_min = 40 and distance_m = 1200 and body = 'hari ini') = 1, 'workout snapshot visible';
  begin perform share_workout(wid); assert false, 'cannot share another log'; exception when sqlstate 'PO001' then null; end;
  begin perform 1 from workout_logs where notes = 'rahasia'; assert (select count(*) from workout_logs) = 0, 'private notes stay private'; end;

  insert into reports (target_type, target_id, reason) values ('post', pid, 'spam berulang');
  begin insert into reports (target_type, target_id, reason) values ('post', pid, 'spam berulang'); assert false, 'one report per target'; exception when unique_violation then null; end;
  begin insert into reports (target_type, target_id, reason) values ('post', pid, 'x'); assert false, 'reason length'; exception when check_violation then null; end;
  begin perform 1 from reports; assert false, 'reports are write only'; exception when insufficient_privilege then null; end;

  begin insert into friendships (requester_id, addressee_id) values (pg_temp.uid('fb@t.test'), pg_temp.uid('fd@t.test')); assert false, 'friendships via rpc only'; exception when insufficient_privilege then null; end;
  begin insert into posts (kind, body) values ('text', 'x'); assert false, 'posts via rpc only'; exception when insufficient_privilege then null; end;
  begin perform 1 from accounts; assert false, 'accounts closed'; exception when insufficient_privilege then null; end;

  perform pg_temp.act('fa@t.test');
  delete from post_comments where id = cid;
  get diagnostics n = row_count;
  assert n = 1, 'the post author can remove a comment';

  perform pg_temp.act('fb@t.test');
  perform block_account(pg_temp.uid('fa@t.test'));
  assert (select count(*) from friendships where requester_id in (pg_temp.uid('fa@t.test'), pg_temp.uid('fb@t.test')) and addressee_id in (pg_temp.uid('fa@t.test'), pg_temp.uid('fb@t.test'))) = 0, 'blocking removes the friendship';
  assert (select count(*) from posts) = 0, 'a blocked author is hidden';
  assert (select count(*) from blocks) = 1, 'blocks are listed to the blocker';
  assert (select count(*) from social_people where username = 'fuser.a') = 1, 'blocked name stays visible to the blocker';
  perform pg_temp.act('fa@t.test');
  assert (select count(*) from blocks) = 0, 'the blocked cannot see blocks';
  begin perform request_friend('fuser.b'); assert false, 'blocked cannot request'; exception when sqlstate 'FR001' then null; end;
  perform pg_temp.act('fb@t.test');
  begin perform request_friend('fuser.a'); assert false, 'blocker cannot request either'; exception when sqlstate 'FR001' then null; end;
  perform unblock_account(pg_temp.uid('fa@t.test'));
  assert request_friend('fuser.a') = 'requested', 'unblocked can request again';

  perform pg_temp.act('fc@t.test');
  perform remove_friend(pg_temp.uid('fb@t.test'));
  assert not is_friend_of(pg_temp.uid('fb@t.test')), 'removed';

  perform set_config('request.jwt.claims', '', true);
  assert (select count(*) from posts) = 0 and (select count(*) from friendships) = 0, 'no token, no data';
  begin perform request_friend('fuser.a'); assert false, 'no token'; exception when sqlstate '42501' then null; end;
end $$;

reset role;

do $$
begin
  for i in 1..50 loop
    insert into posts (account_id, kind, body) values ((select id from accounts where email = 'fd@t.test'), 'text', 'p' || i);
  end loop;
  begin
    insert into posts (account_id, kind, body) values ((select id from accounts where email = 'fd@t.test'), 'text', 'p51');
    assert false, 'daily post cap';
  exception when sqlstate 'PO002' then null; end;
end $$;

delete from accounts where email in ('fa@t.test', 'fb@t.test', 'fc@t.test', 'fd@t.test');
do $$ begin
  assert (select count(*) from posts) = 0 and (select count(*) from friendships) = 0 and (select count(*) from blocks) = 0
    and (select count(*) from post_comments) = 0 and (select count(*) from reports) = 0, 'everything follows the account';
end $$;

rollback;
\echo friends_feed_phase3 OK
