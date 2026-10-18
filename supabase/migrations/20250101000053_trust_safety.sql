alter table accounts
  add column social_banned_at timestamptz,
  add column username_changed_at timestamptz;

create or replace function block_account(p_other uuid) returns void as $$
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_other = current_account_id() or not exists (select 1 from accounts where id = p_other) then
    raise exception using errcode = 'FR001', message = 'Pengguna tidak ditemukan';
  end if;
  insert into blocks (blocker_id, blocked_id) values (current_account_id(), p_other) on conflict do nothing;
  delete from friendships
  where (requester_id = current_account_id() and addressee_id = p_other)
     or (requester_id = p_other and addressee_id = current_account_id());
  delete from event_rsvps r using events e, groups g
  where r.event_id = e.id and e.group_id = g.id
    and ((g.owner_id = current_account_id() and r.account_id = p_other)
      or (g.owner_id = p_other and r.account_id = current_account_id()));
  delete from group_members gm using groups g
  where gm.group_id = g.id and gm.role = 'member'
    and ((g.owner_id = current_account_id() and gm.account_id = p_other)
      or (g.owner_id = p_other and gm.account_id = current_account_id()));
end;
$$ language plpgsql security definer set search_path = public;

create function rotate_club_code() returns text as $$
declare
  v_name text;
  v_slug text;
begin
  if not has_permission('club.settings') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  select name into v_name from clubs where id = current_club_id();
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'klub'), 30) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  update clubs set slug = v_slug where id = current_club_id();
  perform log_audit('club.code_rotated', 'club', current_club_id(), '{}'::jsonb);
  return v_slug;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function rotate_club_code() from public, anon;
grant execute on function rotate_club_code() to authenticated;
