alter table accounts add column if not exists public_profile boolean not null default false;
alter table accounts add column if not exists public_search_ok boolean not null default false;
alter table accounts drop constraint if exists accounts_public_search_requires_profile;
alter table accounts add constraint accounts_public_search_requires_profile check (not public_search_ok or public_profile);

create or replace function username_reserved(p_username text) returns boolean as $$
  select p_username in (
    'admin', 'coach', 'member', 'superadmin', 'api', 'login', 'signup', 'profile', 'privacy', 'terms', 'checkin',
    'home', 'invite', 'sports', 'p', 's', 'g', 'c', 'i', 'r', 'workouts', 'friends', 'groups', 'challenges', 'health',
    'settings', 'upgrade', 'join', 'daftar', 'akun', 'olahraga', 'privasi', 'syarat', 'undangan',
    'robots.txt', 'sitemap.xml', 'favicon.ico', 'icon.svg', 'apple-icon.png', 'opengraph-image',
    'www', 'app', 'help', 'support', 'root', 'system', 'ruzz', 'club27',
    'about', 'blog', 'contact', 'docs', 'explore', 'pricing', 'search', 'status', 'static', 'public', 'assets',
    'me', 'new', 'edit', 'delete', 'official', 'staff', 'team', 'info', 'mail', 'email', 'webmaster', 'postmaster',
    'null', 'undefined'
  );
$$ language sql immutable set search_path = public;

create or replace function public_profile_by_username(p_username text)
returns table (username text, full_name text, public_search_ok boolean) as $$
  select a.username, a.full_name, a.public_search_ok
  from accounts a
  where a.username = lower(trim(p_username))
    and not username_reserved(a.username)
    and a.public_profile
    and a.is_active
    and a.social_banned_at is null;
$$ language sql stable security definer set search_path = public;

create or replace function profile_by_username(p_username text)
returns table (username text, full_name text, relation text) as $$
  select a.username, a.full_name,
    case
      when a.id = current_account_id() then 'self'
      when f.status = 'accepted' then 'friends'
      when f.status = 'pending' and f.requester_id = current_account_id() then 'pending_out'
      when f.status = 'pending' then 'pending_in'
      else 'none'
    end
  from accounts a
  left join friendships f
    on (f.requester_id = current_account_id() and f.addressee_id = a.id)
    or (f.addressee_id = current_account_id() and f.requester_id = a.id)
  where current_account_id() is not null
    and a.username = lower(trim(p_username))
    and not username_reserved(a.username)
    and a.is_active
    and a.social_banned_at is null
    and (a.id = current_account_id() or not is_blocked_pair(a.id))
  limit 1;
$$ language sql stable security definer set search_path = public;

revoke execute on function public_profile_by_username(text) from public, anon, authenticated;
revoke execute on function profile_by_username(text) from public, anon, authenticated;
grant execute on function public_profile_by_username(text) to anon, authenticated;
grant execute on function profile_by_username(text) to authenticated;

do $$
declare v_clash text;
begin
  select string_agg(username, ', ') into v_clash from accounts where username_reserved(username);
  if v_clash is not null then
    raise notice 'accounts with a now-reserved username: %', v_clash;
  end if;
end $$;
