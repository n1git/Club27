create or replace function username_reserved(p_username text) returns boolean as $$
  select p_username in (
    'admin', 'coach', 'member', 'superadmin', 'api', 'login', 'signup', 'profile', 'privacy', 'terms', 'checkin',
    'home', 'invite', 'sports', 'p', 's', 'g', 'c', 'i', 'r', 'workouts', 'friends', 'groups', 'challenges', 'health',
    'settings', 'upgrade', 'join', 'daftar', 'akun', 'olahraga', 'privasi', 'syarat', 'undangan',
    'robots.txt', 'sitemap.xml', 'favicon.ico', 'icon.svg', 'apple-icon.png', 'opengraph-image',
    'www', 'app', 'help', 'support', 'root', 'system', 'ruzz', 'club27',
    'about', 'blog', 'contact', 'docs', 'explore', 'pricing', 'search', 'status', 'static', 'public', 'assets',
    'me', 'new', 'edit', 'delete', 'official', 'staff', 'team', 'info', 'mail', 'email', 'webmaster', 'postmaster',
    'null', 'undefined', 'notifications', 'messages', 'stories'
  );
$$ language sql immutable set search_path = public;
