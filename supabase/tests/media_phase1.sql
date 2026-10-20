\set ON_ERROR_STOP on
begin;

insert into accounts (email, username, full_name, password_hash) values
  ('pa@t.test', 'puser.a', 'A', 'h'), ('pb@t.test', 'puser.b', 'B', 'h'), ('pc@t.test', 'puser.c', 'C', 'h'),
  ('pd@t.test', 'puser.d', 'D', 'h'), ('px@t.test', 'puser.x', 'X', 'h');

create function pg_temp.uid(p_email text) returns uuid language sql security definer as $f$
  select id from accounts where email = p_email
$f$;
grant execute on function pg_temp.uid(text) to public;

create function pg_temp.personal(p_email text) returns void language sql security definer as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', pg_temp.uid(p_email), 'role', 'authenticated', 'club_id', '', 'account_id', pg_temp.uid(p_email),
    'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;
grant execute on function pg_temp.personal(text) to public;

create temp table ctx (post uuid);
grant all on ctx to public;

insert into friendships (requester_id, addressee_id, status) values
  (pg_temp.uid('pa@t.test'), pg_temp.uid('pb@t.test'), 'accepted'),
  (pg_temp.uid('pa@t.test'), pg_temp.uid('pc@t.test'), 'accepted'),
  (pg_temp.uid('pa@t.test'), pg_temp.uid('pd@t.test'), 'accepted');

do $$
declare v uuid;
begin
  insert into posts (account_id, kind, body) values (pg_temp.uid('pa@t.test'), 'text', 'Pagi') returning id into v;
  insert into ctx values (v);
  insert into post_media (post_id, account_id, path, position, width, height, bytes)
  values (v, pg_temp.uid('pa@t.test'), pg_temp.uid('pa@t.test') || '/' || v || '/0.webp', 0, 1600, 1200, 200000);
  begin
    insert into post_media (post_id, account_id, path, position, width, height, bytes)
    values (v, pg_temp.uid('pa@t.test'), 'x/4.webp', 4, 10, 10, 10);
    assert false, 'at most four photos (position 0-3)';
  exception when check_violation then null; end;
  begin
    insert into post_media (post_id, account_id, path, position, width, height, bytes)
    values (v, pg_temp.uid('pa@t.test'), 'x/big.webp', 1, 10, 10, 6000000);
    assert false, 'photo size limit';
  exception when check_violation then null; end;
  assert exists (select 1 from storage.buckets where id = 'post-media' and not public), 'private bucket';
end $$;

set local role authenticated;

do $$
declare c ctx;
begin
  select * into c from ctx;
  perform pg_temp.personal('pb@t.test');
  assert (select count(*) from posts where id = c.post) = 1, 'friend sees the post';
  assert (select count(*) from post_media where post_id = c.post) = 1, 'friend sees the photo row';
  insert into post_reactions (post_id) values (c.post);
  assert (select kind from post_reactions where post_id = c.post and account_id = pg_temp.uid('pb@t.test')) = 'kudos', 'default reaction is kudos';
  update post_reactions set kind = 'fire' where post_id = c.post;
  assert (select kind from kudos_for_posts(array[c.post]) where is_me) = 'fire', 'reaction can be changed and is returned';
  begin update post_reactions set kind = 'love' where post_id = c.post; assert false, 'unknown reaction'; exception when check_violation then null; end;
  begin insert into post_reactions (post_id, kind) values (c.post, 'clap'); assert false, 'one reaction per person'; exception when unique_violation then null; end;
  begin
    insert into post_media (post_id, account_id, path, position, width, height, bytes) values (c.post, pg_temp.uid('pb@t.test'), 'y.webp', 2, 1, 1, 1);
    assert false, 'clients cannot insert photo rows';
  exception when insufficient_privilege then null; end;

  perform pg_temp.personal('pc@t.test');
  insert into post_reactions (post_id, kind) values (c.post, 'clap');
  update post_reactions set kind = 'strong' where account_id = pg_temp.uid('pb@t.test');
  assert (select kind from post_reactions where post_id = c.post and account_id = pg_temp.uid('pb@t.test')) = 'fire', 'cannot change someone else''s reaction';

  perform pg_temp.personal('px@t.test');
  assert (select count(*) from posts where id = c.post) = 0, 'non-friend sees nothing';
  assert (select count(*) from post_media where post_id = c.post) = 0, 'non-friend sees no photo rows';
end $$;

reset role;

do $$
declare c ctx;
begin
  select * into c from ctx;
  insert into reports (reporter_id, target_type, target_id, reason) values
    (pg_temp.uid('pb@t.test'), 'post', c.post, 'spam spam'), (pg_temp.uid('pc@t.test'), 'post', c.post, 'spam spam');
  assert (select hidden_at from posts where id = c.post) is null, 'two reports do not hide';
  insert into reports (reporter_id, target_type, target_id, reason) values (pg_temp.uid('pd@t.test'), 'post', c.post, 'spam spam');
  assert (select hidden_at from posts where id = c.post) is not null, 'three open reports hide the post';
end $$;

set local role authenticated;
do $$
declare c ctx;
begin
  select * into c from ctx;
  perform pg_temp.personal('pb@t.test');
  assert (select count(*) from posts where id = c.post) = 0, 'hidden post invisible to friends';
  assert (select count(*) from post_media where post_id = c.post) = 0, 'hidden post photos invisible';
  assert (select count(*) from kudos_for_posts(array[c.post])) = 0, 'hidden post reactions invisible';
  perform pg_temp.personal('pa@t.test');
  assert (select count(*) from posts where id = c.post) = 1, 'author still sees own hidden post';
end $$;
reset role;

do $$
declare c ctx;
begin
  select * into c from ctx;
  update reports set status = 'dismissed' where target_id = c.post;
  assert (select hidden_at from posts where id = c.post) is null, 'dismissing all reports shows the post again';
  insert into reports (reporter_id, target_type, target_id, reason) values (pg_temp.uid('px@t.test'), 'post', c.post, 'spam spam');
  update reports set status = 'dismissed' where target_id = c.post and reporter_id = pg_temp.uid('pb@t.test');
  update reports set status = 'open' where target_id = c.post and reporter_id in (pg_temp.uid('pc@t.test'), pg_temp.uid('pd@t.test'));
  assert (select hidden_at from posts where id = c.post) is not null, 'three open reports again hide it';
  update reports set status = 'suspended' where target_id = c.post and status = 'open';
  assert (select hidden_at from posts where id = c.post) is not null, 'upheld reports keep the post hidden';
  assert not has_function_privilege('authenticated', 'sync_post_hidden()', 'execute'), 'trigger function not callable';
end $$;

rollback;
\echo media_phase1 OK
