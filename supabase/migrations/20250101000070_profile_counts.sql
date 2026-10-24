create function profile_counts(p_username text) returns table(posts int, friends int) as $$
  select
    (select count(*)::int from posts p where p.account_id = a.id and (a.id = current_account_id() or p.hidden_at is null)),
    (select count(*)::int
      from friendships f
      join accounts o on o.id = case when f.requester_id = a.id then f.addressee_id else f.requester_id end
      where f.status = 'accepted' and a.id in (f.requester_id, f.addressee_id)
        and o.is_active and o.social_banned_at is null)
  from accounts a
  where social_allowed()
    and a.username = lower(btrim(p_username))
    and a.is_active
    and a.social_banned_at is null
    and (a.id = current_account_id() or is_friend_of(a.id));
$$ language sql stable security definer set search_path = public;

revoke execute on function profile_counts(text) from public, anon;
grant execute on function profile_counts(text) to authenticated;
