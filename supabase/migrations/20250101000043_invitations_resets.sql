create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  kind text not null check (kind in ('staff', 'owner')),
  org_role_id uuid references organization_roles(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 254),
  full_name text not null check (char_length(full_name) between 2 and 200),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  email_sent boolean not null default false,
  expires_at timestamptz not null,
  invited_by uuid not null references accounts(id),
  accepted_account_id uuid references accounts(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_scope_check check ((kind = 'staff') = (tenant_id is not null and org_role_id is not null))
);

create unique index invitations_pending_staff_idx on invitations (tenant_id, email) where status = 'pending' and kind = 'staff';
create unique index invitations_pending_owner_idx on invitations (organization_id, email) where status = 'pending' and kind = 'owner';
create index invitations_organization_idx on invitations (organization_id, created_at desc);

alter table invitations enable row level security;
revoke all on invitations from anon, authenticated;

create trigger a00_org_writable before insert or update or delete on invitations
  for each row execute function enforce_org_writable();

create table password_resets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  delivered boolean not null default false,
  requested_by uuid references accounts(id),
  created_at timestamptz not null default now()
);

create index password_resets_account_idx on password_resets (account_id, created_at desc);

alter table password_resets enable row level security;
revoke all on password_resets from anon, authenticated;

create function create_invitation(
  p_org uuid,
  p_tenant uuid,
  p_kind text,
  p_role uuid,
  p_email text,
  p_name text,
  p_token_hash text,
  p_invited_by uuid
) returns uuid as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  perform enforce_billing_gate(p_org);
  if p_kind = 'staff' then
    if not exists (select 1 from tenants where id = p_tenant and organization_id = p_org)
       or not exists (select 1 from organization_roles where id = p_role and organization_id = p_org) then
      raise exception using errcode = '22023', message = 'Klub atau peran tidak valid';
    end if;
    if exists (select 1 from profiles p join accounts a on a.id = p.account_id where p.tenant_id = p_tenant and a.email = v_email) then
      raise exception using errcode = 'IV001', message = 'Email ini sudah terhubung ke klub ini';
    end if;
    update invitations set status = 'revoked' where tenant_id = p_tenant and email = v_email and status = 'pending' and kind = 'staff';
  elsif p_kind = 'owner' then
    if p_tenant is not null or p_role is not null then
      raise exception using errcode = '22023', message = 'Undangan pemilik tidak memakai klub atau peran';
    end if;
    if exists (
      select 1 from organization_members m where m.organization_id = p_org and m.email = v_email and m.is_active and m.base_role in ('p_owner', 'owner')
    ) then
      raise exception using errcode = 'IV001', message = 'Email ini sudah menjadi pemilik organisasi';
    end if;
    update invitations set status = 'revoked' where organization_id = p_org and email = v_email and status = 'pending' and kind = 'owner';
  else
    raise exception using errcode = '22023', message = 'Jenis undangan tidak valid';
  end if;

  insert into invitations (organization_id, tenant_id, kind, org_role_id, email, full_name, token_hash, expires_at, invited_by)
  values (p_org, p_tenant, p_kind, p_role, v_email, btrim(p_name), p_token_hash, now() + interval '7 days', p_invited_by)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function accept_invitation(p_token_hash text, p_account_id uuid)
returns table (out_kind text, out_organization_id uuid, out_tenant_id uuid, out_profile_id uuid) as $$
declare
  i invitations%rowtype;
  a accounts%rowtype;
  r organization_roles%rowtype;
  v_member uuid;
  v_base text;
  v_profile uuid;
  t record;
begin
  select * into i from invitations
  where token_hash = p_token_hash and status = 'pending' and expires_at > now()
  for update;
  if i.id is null then
    return;
  end if;
  select * into a from accounts where id = p_account_id and is_active;
  if a.id is null or a.email <> i.email then
    raise exception using errcode = 'IV002', message = 'Undangan ini untuk email lain';
  end if;
  perform enforce_billing_gate(i.organization_id);

  select m.id, m.base_role into v_member, v_base
  from organization_members m where m.organization_id = i.organization_id and m.account_id = a.id;

  if i.kind = 'staff' then
    select * into r from organization_roles where id = i.org_role_id;
    if exists (select 1 from profiles p where p.tenant_id = i.tenant_id and p.account_id = a.id) then
      raise exception using errcode = 'IV003', message = 'Akun ini sudah terhubung ke klub ini';
    end if;
    if r.is_paid and (v_base is null or v_base = 'staff') then
      if v_member is null then
        insert into organization_members (organization_id, account_id, email, full_name, base_role)
        values (i.organization_id, a.id, a.email, a.full_name, 'staff') returning id into v_member;
      else
        update organization_members set is_active = true where id = v_member and not is_active;
      end if;
      insert into organization_member_clubs (member_id, tenant_id) values (v_member, i.tenant_id) on conflict do nothing;
    end if;
    insert into profiles (tenant_id, role, org_role_id, full_name, email, account_id)
    values (i.tenant_id, 'staff', i.org_role_id, a.full_name, a.email, a.id) returning id into v_profile;
    out_tenant_id := i.tenant_id;
  else
    if v_member is null then
      insert into organization_members (organization_id, account_id, email, full_name, base_role)
      values (i.organization_id, a.id, a.email, a.full_name, 'owner') returning id into v_member;
    elsif v_base = 'staff' then
      delete from organization_member_clubs where member_id = v_member;
      update organization_members set base_role = 'owner', is_active = true where id = v_member;
    elsif v_base not in ('p_owner', 'owner') then
      raise exception 'unexpected member role';
    else
      update organization_members set is_active = true where id = v_member and not is_active;
    end if;
    for t in select id from tenants where organization_id = i.organization_id loop
      if exists (select 1 from profiles p where p.tenant_id = t.id and p.account_id = a.id and p.owner_id is distinct from v_member) then
        raise exception using errcode = 'IV003', message = 'Akun ini sudah punya akses staf di klub organisasi. Nonaktifkan akses itu lebih dulu.';
      end if;
      insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
      values (t.id, 'owner', a.full_name, a.email, v_member, a.id)
      on conflict (owner_id, tenant_id) where owner_id is not null do update set is_active = true;
    end loop;
    select p.id into v_profile from profiles p where p.owner_id = v_member order by p.created_at limit 1;
    out_tenant_id := null;
  end if;

  update invitations set status = 'accepted', accepted_account_id = a.id, accepted_at = now() where id = i.id;
  out_kind := i.kind;
  out_organization_id := i.organization_id;
  out_profile_id := v_profile;
  return next;
end;
$$ language plpgsql security definer set search_path = public;

create function transfer_ownership(p_org uuid, p_to_member uuid, p_actor_account uuid) returns void as $$
declare
  v_from uuid;
  v_from_account uuid;
begin
  select id, account_id into v_from, v_from_account
  from organization_members where organization_id = p_org and base_role = 'p_owner' and is_active for update;
  if v_from is null or v_from_account is distinct from p_actor_account then
    raise exception using errcode = 'OW001', message = 'Hanya pemilik utama yang dapat memindahkan kepemilikan';
  end if;
  if not exists (
    select 1 from organization_members where id = p_to_member and organization_id = p_org and base_role = 'owner' and is_active
  ) then
    raise exception using errcode = 'OW002', message = 'Penerima harus pemilik aktif organisasi ini';
  end if;
  update organization_members set base_role = 'owner' where id = v_from;
  update organization_members set base_role = 'p_owner' where id = p_to_member;
end;
$$ language plpgsql security definer set search_path = public;

create function consume_password_reset(p_token_hash text, p_password_hash text)
returns table (out_account_id uuid, out_email text) as $$
declare
  v password_resets%rowtype;
begin
  select * into v from password_resets
  where token_hash = p_token_hash and used_at is null and expires_at > now()
  for update;
  if v.id is null then
    return;
  end if;
  update accounts set
    password_hash = p_password_hash,
    must_change_password = false,
    failed_login_count = 0,
    locked_until = null,
    sessions_valid_after = now(),
    email_verified_at = case when v.delivered then coalesce(email_verified_at, now()) else email_verified_at end
  where id = v.account_id and is_active
  returning accounts.id, accounts.email into out_account_id, out_email;
  if out_account_id is null then
    return;
  end if;
  update password_resets set used_at = now() where account_id = v.account_id and used_at is null;
  return next;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function create_tenant_for_owner(p_owner_id uuid, p_tenant_name text, p_club_type text default 'swimming')
returns table (tenant_id uuid, profile_id uuid) as $$
declare
  v_owner organization_members%rowtype;
  v_tenant uuid;
  v_profile uuid;
  o record;
begin
  select * into v_owner from organization_members where id = p_owner_id and is_active and base_role in ('p_owner', 'owner');
  if v_owner.id is null or v_owner.account_id is null then
    raise exception 'owner not found';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, p_club_type);

  for o in
    select id, account_id, email, full_name from organization_members
    where organization_id = v_owner.organization_id and is_active and base_role in ('p_owner', 'owner') and account_id is not null
  loop
    insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
    values (v_tenant, 'owner', o.full_name, o.email, o.id, o.account_id) returning id into v_profile;
    if o.id = v_owner.id then
      profile_id := v_profile;
    end if;
  end loop;

  tenant_id := v_tenant;
  return next;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_invitation(uuid, uuid, text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function accept_invitation(text, uuid) from public, anon, authenticated;
revoke execute on function transfer_ownership(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function consume_password_reset(text, text) from public, anon, authenticated;
revoke execute on function create_tenant_for_owner(uuid, text, text) from public, anon, authenticated;
grant execute on function create_invitation(uuid, uuid, text, uuid, text, text, text, uuid) to service_role;
grant execute on function accept_invitation(text, uuid) to service_role;
grant execute on function transfer_ownership(uuid, uuid, uuid) to service_role;
grant execute on function consume_password_reset(text, text) to service_role;
grant execute on function create_tenant_for_owner(uuid, text, text) to service_role;
