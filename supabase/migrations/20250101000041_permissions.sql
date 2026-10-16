create or replace function enforce_profile_identity() returns trigger as $$
declare
  v_owner_org uuid;
  v_owner_email text;
  v_owner_role text;
  v_tenant_org uuid;
  v_account_email text;
begin
  if new.member_account_id is not null then
    select email into v_account_email from member_accounts where id = new.member_account_id;
    if v_account_email is distinct from new.email then
      raise exception 'member profile must use the account email';
    end if;
  elsif new.owner_id is not null then
    select organization_id, email, base_role into v_owner_org, v_owner_email, v_owner_role
    from organization_members where id = new.owner_id;
    select organization_id into v_tenant_org from tenants where id = new.tenant_id;
    if v_owner_org is distinct from v_tenant_org
       or v_owner_email is distinct from new.email
       or v_owner_role not in ('p_owner', 'owner') then
      raise exception 'owner profile must belong to a tenant of the owner organization and use the owner email';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function enforce_owner_email() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.email <> old.email then
    raise exception 'owner email cannot be changed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function enforce_member_account_email() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.email <> old.email then
    raise exception 'member account email cannot be changed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop index profiles_login_email_idx;


create table permissions (
  code text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  module text not null,
  label text not null,
  owner_only boolean not null default false,
  sort_order int not null default 0
);

insert into permissions (code, module, label, owner_only, sort_order) values
  ('dashboard.view', 'Beranda', 'Melihat beranda dan ringkasan klub', false, 10),
  ('members.view_all', 'Anggota', 'Melihat semua anggota', false, 20),
  ('members.view_assigned', 'Anggota', 'Melihat anggota yang diasuh sendiri', false, 21),
  ('members.create', 'Anggota', 'Menambah anggota', false, 22),
  ('members.update_all', 'Anggota', 'Mengubah data anggota', false, 23),
  ('members.change_status', 'Anggota', 'Mengaktifkan dan menonaktifkan anggota', false, 24),
  ('members.edit_notes_assigned', 'Anggota', 'Mengubah catatan anggota yang diasuh sendiri', false, 25),
  ('members.edit_notes_all', 'Anggota', 'Mengubah catatan semua anggota', false, 26),
  ('members.reassign_coach', 'Anggota', 'Mengganti pelatih anggota', false, 27),
  ('members.delete', 'Anggota', 'Menghapus anggota', false, 28),
  ('members.consent', 'Anggota', 'Mencatat persetujuan anggota', false, 29),
  ('members.privacy', 'Anggota', 'Melihat persetujuan dan menganonimkan anggota', false, 30),
  ('members.portal', 'Anggota', 'Mengaktifkan akun portal anggota', false, 31),
  ('members.lookup', 'Anggota', 'Mencari nama anggota aktif', false, 32),
  ('schedule.view', 'Jadwal', 'Melihat jadwal kelas', false, 40),
  ('schedule.manage', 'Jadwal', 'Mengelola kelas, jenis kelas, dan lokasi', false, 41),
  ('schedule.set_substitute', 'Jadwal', 'Menentukan pelatih pengganti', false, 42),
  ('classes.instruct', 'Jadwal', 'Dapat menjadi pelatih kelas', false, 43),
  ('teaching.portal', 'Jadwal', 'Membuka portal pelatih', false, 44),
  ('bookings.view_all', 'Kehadiran', 'Melihat semua pendaftaran kelas dan kehadiran', false, 50),
  ('bookings.view_assigned', 'Kehadiran', 'Melihat kehadiran kelas sendiri', false, 51),
  ('bookings.manage_all', 'Kehadiran', 'Mengelola semua pendaftaran kelas dan kehadiran', false, 52),
  ('bookings.manage_assigned', 'Kehadiran', 'Mengelola kehadiran kelas sendiri', false, 53),
  ('bookings.override_rules', 'Kehadiran', 'Mencatat kehadiran susulan', false, 54),
  ('checkin.view_all', 'Check-in', 'Melihat semua check-in', false, 60),
  ('checkin.view_assigned', 'Check-in', 'Melihat check-in anggota sendiri', false, 61),
  ('checkin.manage', 'Check-in', 'Mengelola titik check-in dan layar QR', false, 62),
  ('checkin.record_all', 'Check-in', 'Mencatat check-in manual semua anggota', false, 63),
  ('checkin.record_assigned', 'Check-in', 'Mencatat check-in manual anggota sendiri', false, 64),
  ('coaches.view', 'Pelatih dan staf', 'Melihat profil pelatih', false, 70),
  ('coaches.manage', 'Pelatih dan staf', 'Mengelola pelatih dan sertifikasinya', false, 71),
  ('staff.view', 'Pelatih dan staf', 'Melihat daftar staf', false, 72),
  ('staff.manage', 'Pelatih dan staf', 'Mengelola akun staf', false, 73),
  ('invoices.view', 'Tagihan', 'Melihat tagihan', false, 80),
  ('invoices.collect', 'Tagihan', 'Menandai tagihan lunas', false, 81),
  ('invoices.manage', 'Tagihan', 'Membuat dan membatalkan tagihan', false, 82),
  ('packages.manage', 'Tagihan', 'Mengelola paket keanggotaan', false, 83),
  ('subscriptions.view', 'Tagihan', 'Melihat langganan anggota', false, 84),
  ('subscriptions.manage', 'Tagihan', 'Mengelola langganan anggota', false, 85),
  ('cash_ledger.view', 'Keuangan', 'Melihat buku kas', false, 90),
  ('cash_ledger.manage', 'Keuangan', 'Mencatat penyesuaian kas', false, 91),
  ('payroll.view', 'Keuangan', 'Melihat penggajian', false, 92),
  ('payroll.manage', 'Keuangan', 'Membuat penggajian', false, 93),
  ('reports.view', 'Keuangan', 'Melihat laporan', false, 94),
  ('pos.sell', 'Kasir', 'Menjual di kasir dan menerima pembayaran', false, 100),
  ('pos.orders_view', 'Kasir', 'Melihat pesanan', false, 101),
  ('pos.products_manage', 'Kasir', 'Mengelola produk', false, 102),
  ('pos.void_paid', 'Kasir', 'Membatalkan pesanan lunas', false, 103),
  ('resources.manage', 'Fasilitas', 'Mengelola fasilitas dan jam buka', false, 110),
  ('resource_bookings.view', 'Fasilitas', 'Melihat booking fasilitas', false, 111),
  ('resource_bookings.manage', 'Fasilitas', 'Mengelola booking fasilitas', false, 112),
  ('promo.manage', 'Klub', 'Mengelola promo', false, 120),
  ('club.settings', 'Klub', 'Mengubah pengaturan klub dan modul', false, 121),
  ('audit.view', 'Klub', 'Melihat log audit klub', false, 122),
  ('billing.view', 'Klub', 'Melihat langganan organisasi', false, 123),
  ('roles.manage', 'Organisasi', 'Mengelola role dan permission', true, 130);

create table organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  is_paid boolean not null default false,
  preset_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organization_roles_name_idx on organization_roles(organization_id, lower(name));
create unique index organization_roles_preset_idx on organization_roles(organization_id, preset_key) where preset_key is not null;

create trigger organization_roles_set_updated_at before update on organization_roles
  for each row execute function set_updated_at();

create table role_permissions (
  role_id uuid not null references organization_roles(id) on delete cascade,
  permission_code text not null references permissions(code),
  primary key (role_id, permission_code)
);

create index role_permissions_code_idx on role_permissions(permission_code);

create function enforce_role_permission() returns trigger as $$
begin
  if exists (select 1 from permissions where code = new.permission_code and owner_only) then
    raise exception using errcode = '23514', message = 'Permission ini hanya untuk pemilik organisasi';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_role_permission() from public, anon, authenticated;

create trigger role_permissions_enforce before insert or update on role_permissions
  for each row execute function enforce_role_permission();

create table role_presets (
  key text primary key,
  name text not null,
  is_paid boolean not null,
  sort_order int not null
);

create table role_preset_permissions (
  preset_key text not null references role_presets(key) on delete cascade,
  permission_code text not null references permissions(code),
  primary key (preset_key, permission_code)
);

insert into role_presets (key, name, is_paid, sort_order) values
  ('admin', 'Admin', true, 1),
  ('resepsionis', 'Resepsionis', true, 2),
  ('keuangan', 'Keuangan', true, 3),
  ('kepala_pelatih', 'Kepala Pelatih', false, 4),
  ('pelatih', 'Pelatih', false, 5),
  ('kasir', 'Kasir', false, 6);

insert into role_preset_permissions (preset_key, permission_code)
select 'admin', code from permissions
where not owner_only
  and code not in (
    'classes.instruct', 'teaching.portal', 'members.view_assigned', 'members.edit_notes_assigned',
    'bookings.view_assigned', 'bookings.manage_assigned', 'checkin.view_assigned', 'checkin.record_assigned'
  );

insert into role_preset_permissions (preset_key, permission_code) values
  ('resepsionis', 'members.view_all'), ('resepsionis', 'members.create'), ('resepsionis', 'members.update_all'),
  ('resepsionis', 'members.consent'), ('resepsionis', 'members.lookup'),
  ('resepsionis', 'schedule.view'), ('resepsionis', 'bookings.view_all'), ('resepsionis', 'bookings.manage_all'),
  ('resepsionis', 'checkin.view_all'), ('resepsionis', 'invoices.view'), ('resepsionis', 'invoices.collect'),
  ('resepsionis', 'pos.sell'), ('resepsionis', 'pos.orders_view'),
  ('resepsionis', 'resource_bookings.view'), ('resepsionis', 'resource_bookings.manage'), ('resepsionis', 'staff.view'),
  ('keuangan', 'invoices.view'), ('keuangan', 'invoices.collect'), ('keuangan', 'invoices.manage'),
  ('keuangan', 'packages.manage'), ('keuangan', 'subscriptions.view'), ('keuangan', 'subscriptions.manage'),
  ('keuangan', 'cash_ledger.view'), ('keuangan', 'cash_ledger.manage'), ('keuangan', 'payroll.view'),
  ('keuangan', 'payroll.manage'), ('keuangan', 'reports.view'), ('keuangan', 'pos.orders_view'),
  ('keuangan', 'members.lookup'), ('keuangan', 'staff.view'),
  ('pelatih', 'classes.instruct'), ('pelatih', 'teaching.portal'), ('pelatih', 'members.view_assigned'),
  ('pelatih', 'members.edit_notes_assigned'), ('pelatih', 'members.consent'), ('pelatih', 'members.portal'),
  ('pelatih', 'bookings.view_assigned'), ('pelatih', 'bookings.manage_assigned'),
  ('pelatih', 'checkin.view_assigned'), ('pelatih', 'checkin.record_assigned'),
  ('kasir', 'pos.sell'), ('kasir', 'pos.orders_view'), ('kasir', 'members.lookup');

insert into role_preset_permissions (preset_key, permission_code)
select 'kepala_pelatih', permission_code from role_preset_permissions where preset_key = 'pelatih';

insert into role_preset_permissions (preset_key, permission_code) values
  ('kepala_pelatih', 'members.view_all'), ('kepala_pelatih', 'members.edit_notes_all'),
  ('kepala_pelatih', 'members.reassign_coach'), ('kepala_pelatih', 'bookings.view_all'),
  ('kepala_pelatih', 'checkin.view_all'), ('kepala_pelatih', 'schedule.view'),
  ('kepala_pelatih', 'schedule.set_substitute'), ('kepala_pelatih', 'coaches.view');

alter table permissions enable row level security;
alter table organization_roles enable row level security;
alter table role_permissions enable row level security;
alter table role_presets enable row level security;
alter table role_preset_permissions enable row level security;
revoke all on permissions, organization_roles, role_permissions, role_presets, role_preset_permissions from anon, authenticated;

create function seed_organization_roles(p_org uuid) returns void as $$
declare
  r record;
  v_role uuid;
begin
  for r in select * from role_presets order by sort_order loop
    insert into organization_roles (organization_id, name, is_paid, preset_key)
    values (p_org, r.name, r.is_paid, r.key)
    on conflict (organization_id, preset_key) where preset_key is not null do nothing
    returning id into v_role;
    if v_role is not null then
      insert into role_permissions (role_id, permission_code)
      select v_role, permission_code from role_preset_permissions where preset_key = r.key;
    end if;
    v_role := null;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function seed_organization_roles(uuid) from public, anon, authenticated;
grant execute on function seed_organization_roles(uuid) to service_role;

alter table profiles add column org_role_id uuid references organization_roles(id);
create index profiles_org_role_idx on profiles(org_role_id) where org_role_id is not null;

select seed_organization_roles(id) from organizations;

alter table profiles drop constraint profiles_role_check;
alter table profiles drop constraint profiles_owner_is_admin;
alter table profiles drop constraint profiles_head_coach_is_coach;

select set_config('club27.audit_suppress', 'on', true);

update profiles p set org_role_id = r.id
from tenants t, organization_roles r
where p.tenant_id = t.id and r.organization_id = t.organization_id
  and p.owner_id is null and p.member_account_id is null
  and r.preset_key = case p.role
    when 'admin' then 'admin'
    when 'receptionist' then 'resepsionis'
    when 'finance' then 'keuangan'
    when 'coach' then case when p.is_head_coach then 'kepala_pelatih' else 'pelatih' end
  end;

update profiles set role = 'owner' where owner_id is not null;
update profiles set role = 'staff' where owner_id is null and member_account_id is null;

insert into organization_members (organization_id, account_id, email, full_name, base_role)
select distinct on (t.organization_id, p.account_id) t.organization_id, p.account_id, p.email, p.full_name, 'staff'
from profiles p
join tenants t on t.id = p.tenant_id
join organization_roles r on r.id = p.org_role_id and r.is_paid
where p.role = 'staff' and p.account_id is not null
  and not exists (select 1 from organization_members m where m.organization_id = t.organization_id and m.account_id = p.account_id);

insert into organization_member_clubs (member_id, tenant_id)
select m.id, p.tenant_id
from profiles p
join tenants t on t.id = p.tenant_id
join organization_roles r on r.id = p.org_role_id and r.is_paid
join organization_members m on m.organization_id = t.organization_id and m.account_id = p.account_id and m.base_role = 'staff'
where p.role = 'staff'
on conflict do nothing;

set constraints all immediate;

alter table profiles add constraint profiles_role_check check (role in ('owner', 'staff', 'member'));
select set_config('club27.audit_suppress', '', true);
alter table profiles add constraint profiles_owner_role check ((role = 'owner') = (owner_id is not null));
alter table profiles add constraint profiles_staff_role check ((role = 'staff') = (org_role_id is not null));

create function current_profile_kind() returns text as $$
  select coalesce((select role from profiles where id = auth.uid() and tenant_id = current_tenant_id()), '');
$$ language sql stable security definer set search_path = public;

revoke execute on function current_profile_kind() from public, anon;
grant execute on function current_profile_kind() to authenticated, service_role;

create function has_permission(p_code text) returns boolean as $$
  select is_active_user() and exists (
    select 1
    from profiles p
    join tenants t on t.id = p.tenant_id
    left join organization_members om on om.id = p.owner_id
    left join organization_roles r on r.id = p.org_role_id
    where p.id = auth.uid()
      and p.tenant_id = current_tenant_id()
      and (
        (p.role = 'owner' and om.is_active and om.base_role in ('p_owner', 'owner'))
        or (
          p.role = 'staff'
          and exists (select 1 from role_permissions rp where rp.role_id = p.org_role_id and rp.permission_code = p_code)
          and (
            not r.is_paid
            or exists (
              select 1
              from organization_members sm
              join organization_member_clubs c on c.member_id = sm.id and c.tenant_id = p.tenant_id
              where sm.account_id = p.account_id
                and sm.organization_id = t.organization_id
                and sm.is_active
                and sm.base_role in ('staff', 'owner', 'p_owner')
            )
          )
        )
      )
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function has_permission(text) from public, anon;
grant execute on function has_permission(text) to authenticated, service_role;

create function profile_permissions(p_profile uuid) returns text[] as $$
  select coalesce((
    select case
      when p.role = 'owner' and om.is_active and om.base_role in ('p_owner', 'owner')
        then (select array_agg(code) from permissions)
      when p.role = 'staff' and (
        not r.is_paid
        or exists (
          select 1
          from organization_members sm
          join organization_member_clubs c on c.member_id = sm.id and c.tenant_id = p.tenant_id
          where sm.account_id = p.account_id
            and sm.organization_id = t.organization_id
            and sm.is_active
            and sm.base_role in ('staff', 'owner', 'p_owner')
        )
      )
        then (select array_agg(rp.permission_code) from role_permissions rp where rp.role_id = p.org_role_id)
    end
    from profiles p
    join tenants t on t.id = p.tenant_id
    left join organization_members om on om.id = p.owner_id
    left join organization_roles r on r.id = p.org_role_id
    where p.id = p_profile and p.is_active
  ), '{}'::text[]);
$$ language sql stable security definer set search_path = public;

revoke execute on function profile_permissions(uuid) from public, anon, authenticated;
grant execute on function profile_permissions(uuid) to service_role;

create function is_instructor(p_profile uuid) returns boolean as $$
  select exists (
    select 1 from profiles p
    join role_permissions rp on rp.role_id = p.org_role_id and rp.permission_code = 'classes.instruct'
    where p.id = p_profile and p.role = 'staff'
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function is_instructor(uuid) from public, anon;
grant execute on function is_instructor(uuid) to authenticated, service_role;

create or replace function is_member() returns boolean as $$
  select current_profile_kind() = 'member' and is_active_user() and current_member_id() is not null;
$$ language sql stable;

create function enforce_profile_role_link() returns trigger as $$
declare
  v_org uuid;
  v_role_org uuid;
  v_paid boolean;
begin
  if new.role <> 'staff' then
    return new;
  end if;
  select organization_id into v_org from tenants where id = new.tenant_id;
  select organization_id, is_paid into v_role_org, v_paid from organization_roles where id = new.org_role_id;
  if v_role_org is distinct from v_org then
    raise exception 'role must belong to the organization of the club';
  end if;
  if v_paid and not exists (
    select 1 from organization_members sm
    join organization_member_clubs c on c.member_id = sm.id and c.tenant_id = new.tenant_id
    where sm.account_id = new.account_id and sm.organization_id = v_org and sm.is_active and sm.base_role = 'staff'
  ) then
    raise exception using errcode = '23514', message = 'Role berbayar memerlukan keanggotaan staf pada klub ini';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_profile_role_link() from public, anon, authenticated;

create trigger profiles_enforce_role_link before insert or update of role, org_role_id, tenant_id, account_id on profiles
  for each row execute function enforce_profile_role_link();

create view instructors with (security_invoker = true) as
select p.id, p.tenant_id, p.account_id, p.full_name, p.email, p.phone, p.is_active, p.specialization, p.session_rate, p.org_role_id, p.created_at
from profiles p
where p.role = 'staff'
  and exists (select 1 from role_permissions rp where rp.role_id = p.org_role_id and rp.permission_code = 'classes.instruct');

grant select on instructors to authenticated;

CREATE OR REPLACE FUNCTION public.add_order_payment(p_order_id uuid, p_method text, p_amount numeric, p_reference text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o orders%rowtype;
  v_paid numeric;
begin
  if not (has_permission('pos.sell')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  select * into o from orders where id = p_order_id and tenant_id = current_tenant_id() for update;
  if o.id is null then
    raise exception using errcode = 'PS002', message = 'Pesanan tidak ditemukan';
  end if;
  if o.status <> 'open' then
    raise exception using errcode = 'PS002', message = 'Pesanan ini sudah tidak bisa dibayar';
  end if;
  perform order_record_payment(o.id, p_method, p_amount, p_reference);
  select coalesce(sum(amount), 0) into v_paid from order_payments where order_id = o.id;
  if v_paid = o.total then
    perform order_settle(o.id);
    return 'paid';
  end if;
  return 'open';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.add_order_payment_once(p_request_id uuid, p_order_id uuid, p_method text, p_amount numeric, p_reference text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
begin
  if not (has_permission('pos.sell')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request id required';
  end if;
  perform pg_advisory_xact_lock(hashtext('payment:' || p_request_id::text));
  if exists (
    select 1 from order_payments
    where client_request_id = p_request_id and order_id = p_order_id and tenant_id = current_tenant_id()
  ) then
    select status into v_status from orders where id = p_order_id;
    return v_status;
  end if;
  perform set_config('club27.payment_request', p_request_id::text, true);
  v_status := add_order_payment(p_order_id, p_method, p_amount, p_reference);
  perform set_config('club27.payment_request', '', true);
  return v_status;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_order(p_member_id uuid, p_customer_name text, p_items jsonb, p_payments jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tenant uuid := current_tenant_id();
  v_order uuid;
  v_item jsonb;
  v_pay jsonb;
  v_kind text;
  v_qty int;
  p products%rowtype;
  b resource_bookings%rowtype;
  v_desc text;
  v_total numeric := 0;
  v_paid numeric := 0;
begin
  if not (has_permission('pos.sell')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(v_tenant, 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = 'PS002', message = 'Pesanan harus berisi 1 sampai 100 item';
  end if;
  if p_member_id is not null and not exists (
    select 1 from members where id = p_member_id and tenant_id = v_tenant and is_active
  ) then
    raise exception using errcode = 'PS002', message = 'Anggota tidak ditemukan';
  end if;

  insert into orders (tenant_id, number, member_id, customer_name, created_by)
  values (v_tenant, next_order_number(v_tenant), p_member_id, nullif(trim(coalesce(p_customer_name, '')), ''), auth.uid())
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_kind := v_item ->> 'kind';
    v_qty := coalesce((v_item ->> 'qty')::int, 1);
    if v_qty < 1 or v_qty > 9999 then
      raise exception using errcode = 'PS002', message = 'Jumlah item tidak valid';
    end if;
    if v_kind = 'product' then
      select * into p from products
      where id = (v_item ->> 'product_id')::uuid and tenant_id = v_tenant and is_active;
      if p.id is null then
        raise exception using errcode = 'PS002', message = 'Produk tidak ditemukan atau nonaktif';
      end if;
      insert into order_items (order_id, tenant_id, kind, product_id, description, qty, unit_price, line_total)
      values (v_order, v_tenant, 'product', p.id, p.name, v_qty, p.price, round(p.price * v_qty, 2));
      v_total := v_total + round(p.price * v_qty, 2);
    elsif v_kind = 'booking' then
      select * into b from resource_bookings
      where id = (v_item ->> 'booking_id')::uuid and tenant_id = v_tenant for update;
      if b.id is null or b.status <> 'confirmed' or b.class_id is not null then
        raise exception using errcode = 'PS005', message = 'Booking tidak dapat ditagih';
      end if;
      if b.paid_at is not null or exists (
        select 1 from order_items oi join orders o on o.id = oi.order_id
        where oi.booking_id = b.id and o.status <> 'void'
      ) then
        raise exception using errcode = 'PS005', message = 'Booking sudah ada di pesanan lain';
      end if;
      if p_member_id is not null and b.member_id is not null and b.member_id <> p_member_id then
        raise exception using errcode = 'PS005', message = 'Booking milik anggota lain';
      end if;
      select 'Booking ' || r.name || ' ' || to_char(b.start_time at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI')
      into v_desc from resources r where r.id = b.resource_id;
      insert into order_items (order_id, tenant_id, kind, booking_id, description, qty, unit_price, line_total)
      values (v_order, v_tenant, 'booking', b.id, v_desc, 1, b.price, b.price);
      v_total := v_total + b.price;
    else
      raise exception using errcode = 'PS002', message = 'Jenis item tidak valid';
    end if;
  end loop;

  update orders set total = v_total where id = v_order;

  if p_payments is not null and jsonb_typeof(p_payments) = 'array' then
    for v_pay in select * from jsonb_array_elements(p_payments) loop
      perform order_record_payment(v_order, v_pay ->> 'method', (v_pay ->> 'amount')::numeric, v_pay ->> 'reference');
      v_paid := v_paid + (v_pay ->> 'amount')::numeric;
    end loop;
  end if;

  if v_paid = v_total then
    perform order_settle(v_order);
  end if;

  return v_order;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_order_once(p_request_id uuid, p_member_id uuid, p_customer_name text, p_items jsonb, p_payments jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not (has_permission('pos.sell')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request id required';
  end if;
  perform pg_advisory_xact_lock(hashtext('order:' || p_request_id::text));
  select id into v_id from orders where client_request_id = p_request_id and tenant_id = current_tenant_id();
  if v_id is not null then
    return v_id;
  end if;
  perform set_config('club27.order_request', p_request_id::text, true);
  v_id := create_order(p_member_id, p_customer_name, p_items, p_payments);
  perform set_config('club27.order_request', '', true);
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.void_order(p_order_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o orders%rowtype;
  r record;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not (has_permission('pos.sell')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  if length(v_reason) < 5 then
    raise exception using errcode = 'PS007', message = 'Tulis alasan pembatalan, minimal 5 karakter';
  end if;
  select * into o from orders where id = p_order_id and tenant_id = current_tenant_id() for update;
  if o.id is null then
    raise exception using errcode = 'PS002', message = 'Pesanan tidak ditemukan';
  end if;
  if o.status = 'void' then
    raise exception using errcode = 'PS006', message = 'Pesanan sudah dibatalkan';
  end if;
  if o.status = 'open' and exists (select 1 from order_payments where order_id = o.id) then
    raise exception using errcode = 'PS006', message = 'Pesanan dengan pembayaran sebagian tidak bisa dibatalkan. Lunasi dulu atau hubungi admin.';
  end if;
  if not has_permission('pos.void_paid') and o.status = 'paid'
     and (o.paid_at at time zone 'Asia/Jakarta')::date <> (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'PS008', message = 'Resepsionis hanya bisa membatalkan pesanan yang lunas hari ini. Hubungi admin.';
  end if;

  if o.status = 'paid' then
    perform 1 from products
    where id in (select product_id from order_items where order_id = o.id and stock_deducted)
    order by id for update;
    for r in
      select product_id, sum(qty)::int as q from order_items
      where order_id = o.id and stock_deducted group by product_id order by product_id
    loop
      update products set stock_qty = stock_qty + r.q where id = r.product_id;
    end loop;
    update order_items set stock_deducted = false where order_id = o.id;

    insert into cash_ledger (tenant_id, category, direction, amount, order_id, reason, created_by)
    select o.tenant_id, 'order_reversal', 'out', amount, o.id, 'Pembatalan pesanan ' || o.number || ': ' || v_reason, auth.uid()
    from order_payments where order_id = o.id;

    update resource_bookings set paid_at = null
    where id in (select booking_id from order_items where order_id = o.id and booking_id is not null);
  end if;

  update orders set status = 'void', voided_at = now(), void_reason = v_reason, voided_by = auth.uid() where id = o.id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.anonymise_member(p_member_id uuid, p_reason text, p_confirm text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m members%rowtype;
  v_account uuid;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not has_permission('members.privacy') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if coalesce(p_confirm, '') <> 'ANONIMKAN' then
    raise exception using errcode = 'AN001', message = 'Ketik ANONIMKAN untuk mengonfirmasi';
  end if;
  if length(v_reason) < 5 then
    raise exception using errcode = 'AN002', message = 'Tulis alasan, minimal 5 karakter';
  end if;
  select * into m from members where id = p_member_id and tenant_id = current_tenant_id() for update;
  if m.id is null then
    raise exception using errcode = 'AN003', message = 'Anggota tidak ditemukan';
  end if;

  perform set_config('club27.audit_suppress', 'on', true);

  update members set
    full_name = 'Anggota anonim ' || left(id::text, 8),
    date_of_birth = date '1900-01-01',
    notes = null,
    address = null,
    contact_name = null,
    contact_phone = null,
    is_active = false,
    profile_id = null
  where id = m.id;

  if m.profile_id is not null then
    select member_account_id into v_account from profiles where id = m.profile_id;
    update resource_bookings set created_by = null where created_by = m.profile_id;
    delete from profiles where id = m.profile_id;
    if v_account is not null and not exists (select 1 from profiles where member_account_id = v_account) then
      delete from member_accounts where id = v_account;
    end if;
  end if;

  update bookings set notes = null where member_id = m.id;
  update orders set customer_name = null where member_id = m.id;
  update resource_bookings set guest_name = null, guest_phone = null where member_id = m.id;
  update consents set guardian_name = null where subject_type = 'member' and subject_id = m.id;

  perform set_config('club27.audit_suppress', '', true);
  perform log_audit('member.anonymise', 'member', m.id, jsonb_build_object('reason', v_reason), m.tenant_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.book_class(p_class_id uuid, p_member_id uuid, p_late_attendance boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_start timestamptz;
begin
  if p_late_attendance and not has_permission('bookings.override_rules') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_late_attendance then
    perform set_config('club27.late_attendance', 'on', true);
  end if;
  select start_time into v_start from classes where id = p_class_id;
  insert into bookings (member_id, class_id, is_attended, attended_at)
  values (
    p_member_id,
    p_class_id,
    p_late_attendance and v_start <= now(),
    case when p_late_attendance and v_start <= now() then v_start end
  )
  returning id into v_id;
  perform set_config('club27.late_attendance', '', true);
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_booking_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz;
  v_day date;
begin
  if auth.uid() is null then
    return new;
  end if;
  if coalesce(current_setting('club27.late_attendance', true), '') = 'on' and has_permission('bookings.override_rules') then
    perform log_audit('booking.late_attendance', 'booking', new.id,
      jsonb_build_object('class_id', new.class_id, 'member_id', new.member_id), new.tenant_id);
    return new;
  end if;
  select start_time into v_start from classes where id = new.class_id;
  if v_start <= now() then
    raise exception using errcode = 'BK001', message = 'Kelas sudah dimulai, anggota tidak bisa didaftarkan lagi';
  end if;
  v_day := (v_start at time zone 'Asia/Jakarta')::date;
  if not exists (
    select 1 from subscriptions
    where member_id = new.member_id and status = 'active'
      and start_date <= v_day and (end_date is null or end_date >= v_day)
  ) then
    raise exception using errcode = 'BK002', message = 'Anggota belum punya paket aktif untuk tanggal kelas ini';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.book_resource(p_resource_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_member_id uuid DEFAULT NULL::uuid, p_guest_name text DEFAULT NULL::text, p_guest_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (has_permission('resource_bookings.manage')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  if (p_member_id is not null) = (nullif(trim(coalesce(p_guest_name, '')), '') is not null) then
    raise exception using errcode = 'RB008', message = 'Pilih anggota atau isi nama tamu';
  end if;
  if p_end <= now() then
    raise exception using errcode = 'RB004', message = 'Waktu booking sudah lewat';
  end if;
  return resource_booking_insert(p_resource_id, p_start, p_end, p_member_id, p_guest_name, p_guest_phone, 'staff');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b resource_bookings%rowtype;
  v_cancel_hours int;
  v_staff boolean := has_permission('resource_bookings.manage');
begin
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  select * into b from resource_bookings where id = p_booking_id and tenant_id = current_tenant_id() for update;
  if b.id is null then
    raise exception using errcode = 'RB008', message = 'Booking tidak ditemukan';
  end if;
  if not v_staff and not (is_member() and b.member_id = current_member_id()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if b.class_id is not null then
    raise exception using errcode = 'RB008', message = 'Booking kelas dikelola lewat jadwal kelas';
  end if;
  if b.status <> 'confirmed' then
    raise exception using errcode = 'RB008', message = 'Booking ini sudah tidak aktif';
  end if;
  if not v_staff then
    select cancel_hours into v_cancel_hours from resources where id = b.resource_id;
    if b.start_time - make_interval(hours => v_cancel_hours) < now() then
      raise exception using errcode = 'RB005', message = format('Pembatalan hanya bisa sampai %s jam sebelum mulai', v_cancel_hours);
    end if;
  end if;
  update resource_bookings set status = 'cancelled' where id = b.id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_booking_status(p_booking_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b resource_bookings%rowtype;
begin
  if not (has_permission('resource_bookings.manage')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  if p_status not in ('completed', 'no_show') then
    raise exception using errcode = 'RB008', message = 'Status tidak valid';
  end if;
  select * into b from resource_bookings where id = p_booking_id and tenant_id = current_tenant_id() for update;
  if b.id is null or b.class_id is not null or b.status <> 'confirmed' then
    raise exception using errcode = 'RB008', message = 'Booking tidak dapat diubah';
  end if;
  if b.start_time > now() then
    raise exception using errcode = 'RB008', message = 'Booking belum dimulai';
  end if;
  update resource_bookings set status = p_status where id = b.id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_resource(p_location_id uuid, p_name text, p_kind text, p_capacity integer, p_slot_minutes integer, p_price_per_slot numeric, p_advance_days integer, p_cancel_hours integer, p_opens time without time zone, p_closes time without time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not has_permission('resources.manage') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;

  insert into resources (tenant_id, location_id, name, kind, capacity, slot_minutes, price_per_slot, advance_days, cancel_hours)
  values (current_tenant_id(), p_location_id, trim(p_name), p_kind, p_capacity, p_slot_minutes, p_price_per_slot, p_advance_days, p_cancel_hours)
  returning id into v_id;

  insert into resource_hours (resource_id, tenant_id, weekday, opens, closes)
  select v_id, current_tenant_id(), d, p_opens, p_closes from generate_series(0, 6) d;

  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_resource_hours(p_resource_id uuid, p_hours jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not has_permission('resources.manage') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not exists (select 1 from resources where id = p_resource_id and tenant_id = current_tenant_id()) then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  delete from resource_hours where resource_id = p_resource_id;
  insert into resource_hours (resource_id, tenant_id, weekday, opens, closes)
  select p_resource_id, current_tenant_id(), (h ->> 'weekday')::int, (h ->> 'opens')::time, (h ->> 'closes')::time
  from jsonb_array_elements(p_hours) h;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.checkin_token(p_point_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not has_permission('checkin.manage') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not exists (
    select 1 from checkin_points where id = p_point_id and tenant_id = current_tenant_id() and is_active
  ) then
    raise exception 'point not found';
  end if;
  return checkin_token_for(p_point_id, checkin_window(0));
end;
$function$
;
CREATE OR REPLACE FUNCTION public.complete_onboarding()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not has_permission('club.settings') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update tenants set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = current_tenant_id();
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_club_module(p_module text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not has_permission('club.settings') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_module = 'members' or not exists (select 1 from platform_modules where code = p_module) then
    raise exception using errcode = 'MD001', message = 'Modul ini tidak dapat diubah';
  end if;
  insert into tenant_module_overrides (tenant_id, module_code, enabled, changed_by)
  values (current_tenant_id(), p_module, p_enabled, auth.uid())
  on conflict (tenant_id, module_code) do update
    set enabled = excluded.enabled, changed_by = excluded.changed_by, changed_at = now();
end;
$function$
;
CREATE OR REPLACE FUNCTION public.manual_checkin(p_member_id uuid, p_point_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(out_checkin_id uuid, out_checked_in_at timestamp with time zone, out_already boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (has_permission('checkin.record_all') or (has_permission('checkin.record_assigned') and coach_owns_member(p_member_id))) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not exists (select 1 from members where id = p_member_id and tenant_id = current_tenant_id()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_point_id is not null and not exists (
    select 1 from checkin_points where id = p_point_id and tenant_id = current_tenant_id()
  ) then
    raise exception 'point not found';
  end if;
  return query select * from checkin_core(p_member_id, p_point_id, 'manual', auth.uid());
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_payroll_run(p_coach_id uuid, p_period_start date, p_period_end date, p_base_salary numeric, p_bonus numeric, p_thr numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_run_id uuid;
  v_ledger_id uuid;
  v_total numeric;
  v_tenant_id uuid;
begin
  if not (has_permission('payroll.manage')) then
    raise exception 'forbidden';
  end if;

  v_tenant_id := current_tenant_id();

  if not exists (
    select 1 from profiles where id = p_coach_id and is_instructor(id) and tenant_id = v_tenant_id
  ) then
    raise exception 'coach not found in this tenant';
  end if;

  insert into payroll_runs (tenant_id, coach_id, period_start, period_end, base_salary, bonus, thr, status)
  values (v_tenant_id, p_coach_id, p_period_start, p_period_end, p_base_salary, p_bonus, p_thr, 'draft')
  returning id, total_amount into v_run_id, v_total;

  insert into cash_ledger (tenant_id, category, direction, amount, payroll_run_id, created_by)
  values (v_tenant_id, 'payroll', 'out', v_total, v_run_id, auth.uid())
  returning id into v_ledger_id;

  update payroll_runs
  set cash_ledger_entry_id = v_ledger_id, status = 'posted', posted_at = now()
  where id = v_run_id;

  return v_run_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_amount numeric(12, 2);
  v_tenant_id uuid;
begin
  if not (has_permission('invoices.collect')) then
    raise exception 'forbidden';
  end if;

  v_tenant_id := current_tenant_id();

  update invoices
  set status = 'paid', paid_at = now()
  where id = p_invoice_id and status = 'outstanding' and tenant_id = v_tenant_id
  returning amount into v_amount;

  if v_amount is null then
    raise exception 'invoice not found or already settled';
  end if;

  insert into cash_ledger (tenant_id, category, direction, amount, invoice_id, created_by)
  values (v_tenant_id, 'payment_received', 'in', v_amount, p_invoice_id, auth.uid());
end;
$function$
;
CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (has_permission('invoices.manage')) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update invoices set status = 'void'
  where id = p_invoice_id and tenant_id = current_tenant_id() and status = 'outstanding';
  if not found then
    raise exception using errcode = 'IV001', message = 'Tagihan tidak ditemukan atau sudah lunas';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_class_substitute()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_teacher uuid := coalesce(new.substitute_id, new.instructor_id);
begin
  if new.substitute_id is not null then
    if new.substitute_id = new.instructor_id then
      raise exception 'substitute must differ from the instructor';
    end if;
    if not exists (
      select 1 from profiles
      where id = new.substitute_id and is_instructor(id) and is_active and tenant_id = new.tenant_id
    ) then
      raise exception 'substitute_id must reference an active coach in the same tenant';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('class-teacher:' || v_teacher::text));

  if exists (
    select 1 from classes c
    where c.id <> new.id
      and c.tenant_id = new.tenant_id
      and coalesce(c.substitute_id, c.instructor_id) = v_teacher
      and tstzrange(c.start_time, c.end_time, '[)') && tstzrange(new.start_time, new.end_time, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'coach already teaches another class at this time';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_classes_instructor_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from profiles
    where id = new.instructor_id and is_instructor(id) and tenant_id = new.tenant_id
  ) then
    raise exception 'instructor_id must reference an instructor profile in the same tenant';
  end if;
  if not exists (select 1 from locations where id = new.location_id and tenant_id = new.tenant_id) then
    raise exception 'location_id must belong to the same tenant';
  end if;
  if not exists (select 1 from class_types where id = new.class_type_id and tenant_id = new.tenant_id) then
    raise exception 'class_type_id must belong to the same tenant';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_coach_certification_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from profiles where id = new.coach_id and is_instructor(id) and tenant_id = new.tenant_id
  ) then
    raise exception 'coach_id must reference an instructor profile in the same tenant';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_members_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.preferred_location_id is not null and not exists (
    select 1 from locations where id = new.preferred_location_id and tenant_id = new.tenant_id
  ) then
    raise exception 'preferred_location_id must belong to the same tenant';
  end if;
  if new.coach_id is not null and not exists (
    select 1 from profiles where id = new.coach_id and is_instructor(id) and tenant_id = new.tenant_id
  ) then
    raise exception 'coach_id must reference an instructor profile in the same tenant';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_payroll_coach_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from profiles
    where id = new.coach_id and is_instructor(id) and tenant_id = new.tenant_id
  ) then
    raise exception 'coach_id must reference an instructor profile in the same tenant';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.record_checkin(p_point_id uuid, p_token text)
 RETURNS TABLE(out_checkin_id uuid, out_checked_in_at timestamp with time zone, out_already boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_point checkin_points%rowtype;
  v_member uuid;
begin
  if current_profile_kind() <> 'member' or not is_active_user() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  select * into v_point from checkin_points
  where id = p_point_id and tenant_id = current_tenant_id() and is_active;
  if v_point.id is null
     or p_token is null
     or not (
       p_token = checkin_token_for(v_point.id, checkin_window(0))
       or p_token = checkin_token_for(v_point.id, checkin_window(1))
     ) then
    raise exception using errcode = 'CK005', message = 'Kode QR tidak valid atau sudah kedaluwarsa, pindai ulang';
  end if;

  v_member := current_member_id();
  if v_member is null then
    raise exception using errcode = 'CK002', message = 'Keanggotaan Anda tidak aktif';
  end if;

  return query select * from checkin_core(v_member, v_point.id, 'qr', null);
end;
$function$
;

create or replace function enforce_coach_member_update() returns trigger as $$
declare
  v_allowed text[];
begin
  if auth.uid() is null or has_permission('members.update_all') then
    if auth.uid() is not null and new.is_active is distinct from old.is_active and not has_permission('members.change_status') then
      raise exception 'member status needs the members.change_status permission';
    end if;
    return new;
  end if;
  v_allowed := case when has_permission('members.reassign_coach')
    then array['notes', 'updated_at', 'coach_id']
    else array['notes', 'updated_at'] end;
  if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'only member notes may be changed with this permission';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function enforce_head_coach_class_update() returns trigger as $$
begin
  if auth.uid() is not null
     and not has_permission('schedule.manage')
     and has_permission('schedule.set_substitute')
     and (to_jsonb(new) - array['substitute_id', 'updated_at'])
         is distinct from (to_jsonb(old) - array['substitute_id', 'updated_at']) then
    raise exception 'only the substitute may be changed with this permission';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function enforce_profile_billing() returns trigger as $$
declare
  v_org uuid;
begin
  if new.role <> 'staff' or not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active and old.role = 'staff' then
    return new;
  end if;
  select organization_id into v_org from tenants where id = new.tenant_id;
  perform enforce_billing_gate(v_org);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function audit_staff_profile_change() returns trigger as $$
begin
  if new.role = 'member' then
    return new;
  end if;
  if new.org_role_id is distinct from old.org_role_id then
    perform log_audit('staff.role', 'profile', new.id,
      jsonb_build_object(
        'from', (select name from organization_roles where id = old.org_role_id),
        'to', (select name from organization_roles where id = new.org_role_id)
      ), new.tenant_id);
  end if;
  if new.is_active is distinct from old.is_active then
    perform log_audit(case when new.is_active then 'staff.activate' else 'staff.deactivate' end, 'profile', new.id, '{}'::jsonb, new.tenant_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function enforce_profile_self_update() returns trigger as $$
begin
  if auth.uid() is null or has_permission('staff.manage') then
    return new;
  end if;
  if (to_jsonb(new) - array['full_name', 'phone', 'updated_at'])
     is distinct from (to_jsonb(old) - array['full_name', 'phone', 'updated_at']) then
    raise exception 'only a staff manager may change these profile fields';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function enforce_profile_account_link() returns trigger as $$
begin
  if auth.uid() is not null
     and new.account_id is not null
     and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then
    raise exception 'account link cannot be changed';
  end if;
  if tg_op = 'UPDATE' and old.account_id is not null and new.account_id is null and auth.uid() is not null then
    raise exception 'account link cannot be changed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;





create or replace function organization_internal_users(p_org uuid) returns integer as $$
  select count(*)::int from organization_members where organization_id = p_org and is_active;
$$ language sql stable security definer set search_path = public;

create or replace function register_organization(
  p_organization_name text,
  p_tenant_name text,
  p_account_id uuid,
  p_plan text,
  p_period text,
  p_club_type text default 'swimming'
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  v_account accounts%rowtype;
  v_org uuid;
  v_tenant uuid;
  v_owner uuid;
  v_profile uuid;
  v_trial_days int;
begin
  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'invalid billing period';
  end if;
  select trial_days into v_trial_days from subscription_plans where code = p_plan and is_active;
  if not found then
    raise exception 'plan not available';
  end if;
  select * into v_account from accounts where id = p_account_id and is_active;
  if v_account.id is null then
    raise exception 'account not found';
  end if;

  insert into organizations (name) values (p_organization_name) returning id into v_org;
  perform seed_organization_roles(v_org);

  insert into organization_subscriptions (organization_id, plan_code, billing_period, status, trial_ends_at)
  values (
    v_org,
    p_plan,
    p_period,
    case when v_trial_days > 0 then 'trial' else 'pending' end,
    case when v_trial_days > 0 then (now() at time zone 'Asia/Jakarta')::date + v_trial_days end
  );

  insert into organization_members (organization_id, account_id, email, full_name, base_role)
  values (v_org, v_account.id, v_account.email, v_account.full_name, 'p_owner') returning id into v_owner;

  v_tenant := create_tenant_row(v_org, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
  values (v_tenant, 'owner', v_account.full_name, v_account.email, v_owner, v_account.id) returning id into v_profile;

  return query select v_org, v_tenant, v_owner, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function create_tenant_for_owner(p_owner_id uuid, p_tenant_name text, p_club_type text default 'swimming')
returns table (tenant_id uuid, profile_id uuid) as $$
declare
  v_owner organization_members%rowtype;
  v_tenant uuid;
  v_profile uuid;
begin
  select * into v_owner from organization_members where id = p_owner_id and is_active and base_role in ('p_owner', 'owner');
  if v_owner.id is null or v_owner.account_id is null then
    raise exception 'owner not found';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
  values (v_tenant, 'owner', v_owner.full_name, v_owner.email, v_owner.id, v_owner.account_id) returning id into v_profile;

  return query select v_tenant, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

drop policy audit_log_select on audit_log;
create policy audit_log_select on audit_log for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select has_permission('audit.view'))) or ((select current_profile_is_owner()) and organization_id = (select t.organization_id from tenants t where t.id = (select current_tenant_id()))));

drop policy bookings_delete on bookings;
create policy bookings_delete on bookings for delete to authenticated
  using (tenant_id = (select current_tenant_id()) and ((select has_permission('bookings.manage_all')) or ((select has_permission('bookings.manage_assigned')) and (coach_owns_class(class_id) and coach_owns_member(member_id)))));

drop policy bookings_insert on bookings;
create policy bookings_insert on bookings for insert to authenticated
  with check (tenant_id = (select current_tenant_id()) and ((select has_permission('bookings.manage_all')) or ((select has_permission('bookings.manage_assigned')) and (coach_owns_class(class_id) and coach_owns_member(member_id)))));

drop policy bookings_select on bookings;
create policy bookings_select on bookings for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and ((select has_permission('bookings.view_all')) or ((select has_permission('bookings.view_assigned')) and ((coach_owns_class(class_id) and coach_owns_member(member_id)) or coach_substitutes_class(class_id))))) or (tenant_id = (select current_tenant_id()) and (select is_member()) and member_id = (select current_member_id())));

drop policy bookings_update on bookings;
create policy bookings_update on bookings for update to authenticated
  using (tenant_id = (select current_tenant_id()) and ((select has_permission('bookings.manage_all')) or ((select has_permission('bookings.manage_assigned')) and ((coach_owns_class(class_id) and coach_owns_member(member_id)) or coach_substitutes_class(class_id)))))
  with check (tenant_id = (select current_tenant_id()) and ((select has_permission('bookings.manage_all')) or ((select has_permission('bookings.manage_assigned')) and ((coach_owns_class(class_id) and coach_owns_member(member_id)) or coach_substitutes_class(class_id)))));

drop policy cash_ledger_insert on cash_ledger;
create policy cash_ledger_insert on cash_ledger for insert to authenticated
  with check ((select has_permission('cash_ledger.manage')) and tenant_id = (select current_tenant_id()) and category = 'manual_adjustment');

drop policy cash_ledger_select on cash_ledger;
create policy cash_ledger_select on cash_ledger for select to authenticated
  using ((select has_permission('cash_ledger.view')) and tenant_id = (select current_tenant_id()));

drop policy checkin_points_insert_admin on checkin_points;
create policy checkin_points_insert_admin on checkin_points for insert to authenticated
  with check ((select has_permission('checkin.manage')) and tenant_id = (select current_tenant_id()));

drop policy checkin_points_select_admin on checkin_points;
create policy checkin_points_select_admin on checkin_points for select to authenticated
  using ((select has_permission('checkin.manage')) and tenant_id = (select current_tenant_id()));

drop policy checkin_points_update_admin on checkin_points;
create policy checkin_points_update_admin on checkin_points for update to authenticated
  using ((select has_permission('checkin.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('checkin.manage')) and tenant_id = (select current_tenant_id()));

drop policy checkins_select on checkins;
create policy checkins_select on checkins for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select has_permission('checkin.view_assigned')) and coach_owns_member(member_id)) or (tenant_id = (select current_tenant_id()) and (select is_member()) and member_id = (select current_member_id())) or (tenant_id = (select current_tenant_id()) and (select has_permission('checkin.view_all'))));

drop policy class_types_write_admin on class_types;
create policy class_types_write_admin on class_types for all to authenticated
  using ((select has_permission('schedule.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('schedule.manage')) and tenant_id = (select current_tenant_id()));

drop policy classes_update_head_coach on classes;
create policy classes_update_head_coach on classes for update to authenticated
  using (tenant_id = (select current_tenant_id()) and (select has_permission('schedule.set_substitute')))
  with check (tenant_id = (select current_tenant_id()) and (select has_permission('schedule.set_substitute')));

drop policy classes_write_admin on classes;
create policy classes_write_admin on classes for all to authenticated
  using ((select has_permission('schedule.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('schedule.manage')) and tenant_id = (select current_tenant_id()));

drop policy coach_certifications_select on coach_certifications;
create policy coach_certifications_select on coach_certifications for select to authenticated
  using (tenant_id = (select current_tenant_id()) and ((select has_permission('coaches.manage')) or ((select has_permission('classes.instruct')) and coach_id = (select auth.uid()))));

drop policy coach_certifications_write_admin on coach_certifications;
create policy coach_certifications_write_admin on coach_certifications for all to authenticated
  using ((select has_permission('coaches.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('coaches.manage')) and tenant_id = (select current_tenant_id()));

drop policy consents_insert on consents;
create policy consents_insert on consents for insert to authenticated
  with check (tenant_id = (select current_tenant_id()) and subject_type = 'member' and kind = any (array['member_data', 'guardian']) and (select has_permission('members.consent')) and exists (select 1 from members m where m.id = consents.subject_id and m.tenant_id = (select current_tenant_id())));

drop policy consents_select on consents;
create policy consents_select on consents for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select has_permission('members.privacy'))) or (subject_type = 'member' and subject_id = (select current_member_id())));

drop policy invoices_select on invoices;
create policy invoices_select on invoices for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select has_permission('invoices.view'))) or (tenant_id = (select current_tenant_id()) and (select is_member()) and member_id = (select current_member_id())));

drop policy locations_write_admin on locations;
create policy locations_write_admin on locations for all to authenticated
  using ((select has_permission('schedule.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('schedule.manage')) and tenant_id = (select current_tenant_id()));

drop policy members_delete on members;
create policy members_delete on members for delete to authenticated
  using (tenant_id = (select current_tenant_id()) and (select has_permission('members.delete')));

drop policy members_insert on members;
create policy members_insert on members for insert to authenticated
  with check (tenant_id = (select current_tenant_id()) and (select has_permission('members.create')));

drop policy members_select on members;
create policy members_select on members for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and ((select has_permission('members.view_all')) or ((select has_permission('members.view_assigned')) and (coach_id = (select auth.uid()) or coach_substitutes_member(id))))) or (tenant_id = (select current_tenant_id()) and (select is_member()) and id = (select current_member_id())));

drop policy members_update on members;
create policy members_update on members for update to authenticated
  using (tenant_id = (select current_tenant_id()) and ((select has_permission('members.update_all')) or (select has_permission('members.edit_notes_all')) or ((select has_permission('members.edit_notes_assigned')) and coach_id = (select auth.uid()))))
  with check (tenant_id = (select current_tenant_id()) and ((select has_permission('members.update_all')) or (select has_permission('members.edit_notes_all')) or ((select has_permission('members.edit_notes_assigned')) and coach_id = (select auth.uid()))));

drop policy membership_packages_write on membership_packages;
create policy membership_packages_write on membership_packages for all to authenticated
  using ((select has_permission('packages.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('packages.manage')) and tenant_id = (select current_tenant_id()));

drop policy order_payments_select on order_payments;
create policy order_payments_select on order_payments for select to authenticated
  using (tenant_id = (select current_tenant_id()) and (select has_permission('pos.orders_view')));

drop policy orders_select on orders;
create policy orders_select on orders for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select is_member()) and member_id = (select current_member_id()) and status = 'paid') or (tenant_id = (select current_tenant_id()) and (select has_permission('pos.orders_view'))));

drop policy organization_subscriptions_select_own on organization_subscriptions;
create policy organization_subscriptions_select_own on organization_subscriptions for select to authenticated
  using ((select has_permission('billing.view')) and organization_id = (select t.organization_id from tenants t where t.id = (select current_tenant_id())));

drop policy organizations_select_own on organizations;
create policy organizations_select_own on organizations for select to authenticated
  using ((select has_permission('billing.view')) and exists (select 1 from tenants t where t.id = (select current_tenant_id()) and t.organization_id = organizations.id));

drop policy payroll_runs_select on payroll_runs;
create policy payroll_runs_select on payroll_runs for select to authenticated
  using ((select has_permission('payroll.view')) and tenant_id = (select current_tenant_id()));

drop policy platform_subscriptions_select_own on platform_subscriptions;
create policy platform_subscriptions_select_own on platform_subscriptions for select to authenticated
  using ((select has_permission('billing.view')) and tenant_id = (select current_tenant_id()));

drop policy products_insert on products;
create policy products_insert on products for insert to authenticated
  with check ((select has_permission('pos.products_manage')) and tenant_id = (select current_tenant_id()));

drop policy products_select on products;
create policy products_select on products for select to authenticated
  using (tenant_id = (select current_tenant_id()) and ((select has_permission('pos.orders_view')) or (select has_permission('pos.products_manage'))));

drop policy products_update on products;
create policy products_update on products for update to authenticated
  using ((select has_permission('pos.products_manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('pos.products_manage')) and tenant_id = (select current_tenant_id()));

drop policy profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select has_permission('coaches.view')) and is_instructor(id)) or id = (select auth.uid()) or (tenant_id = (select current_tenant_id()) and (select has_permission('staff.view'))));

drop policy profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (((select has_permission('staff.manage')) and tenant_id = (select current_tenant_id()) and (owner_id is null or (select current_profile_is_owner()))) or (id = (select auth.uid()) and (select is_active_user()) and (select current_profile_kind()) <> 'member'))
  with check ((tenant_id = (select current_tenant_id()) and (owner_id is null or (select current_profile_is_owner()))) or (id = (select auth.uid()) and role = (select current_profile_kind()) and tenant_id = (select current_tenant_id())));

drop policy promo_select on promo;
create policy promo_select on promo for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and active_from <= now() and (active_until is null or active_until >= now()) and (select is_active_user())) or ((select has_permission('promo.manage')) and tenant_id = (select current_tenant_id())));

drop policy promo_write_admin on promo;
create policy promo_write_admin on promo for all to authenticated
  using ((select has_permission('promo.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('promo.manage')) and tenant_id = (select current_tenant_id()));

drop policy resource_bookings_select on resource_bookings;
create policy resource_bookings_select on resource_bookings for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select has_permission('bookings.view_assigned')) and class_id is not null and coach_owns_class(class_id)) or (tenant_id = (select current_tenant_id()) and (select is_member()) and member_id = (select current_member_id())) or (tenant_id = (select current_tenant_id()) and (select has_permission('resource_bookings.view'))));

drop policy resource_hours_write_admin on resource_hours;
create policy resource_hours_write_admin on resource_hours for all to authenticated
  using ((select has_permission('resources.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('resources.manage')) and tenant_id = (select current_tenant_id()));

drop policy resources_insert_admin on resources;
create policy resources_insert_admin on resources for insert to authenticated
  with check ((select has_permission('resources.manage')) and tenant_id = (select current_tenant_id()));

drop policy resources_update_admin on resources;
create policy resources_update_admin on resources for update to authenticated
  using ((select has_permission('resources.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('resources.manage')) and tenant_id = (select current_tenant_id()));

drop policy subscriptions_select on subscriptions;
create policy subscriptions_select on subscriptions for select to authenticated
  using ((tenant_id = (select current_tenant_id()) and (select has_permission('subscriptions.view'))) or (tenant_id = (select current_tenant_id()) and (select is_member()) and member_id = (select current_member_id())));

drop policy subscriptions_write on subscriptions;
create policy subscriptions_write on subscriptions for all to authenticated
  using ((select has_permission('subscriptions.manage')) and tenant_id = (select current_tenant_id()))
  with check ((select has_permission('subscriptions.manage')) and tenant_id = (select current_tenant_id()));

drop policy tenant_module_overrides_select_admin on tenant_module_overrides;
create policy tenant_module_overrides_select_admin on tenant_module_overrides for select to authenticated
  using ((select has_permission('club.settings')) and tenant_id = (select current_tenant_id()));

drop policy tenants_update_admin on tenants;
create policy tenants_update_admin on tenants for update to authenticated
  using ((select has_permission('club.settings')) and id = (select current_tenant_id()))
  with check (id = (select current_tenant_id()));

drop policy promo_storage_write on storage.objects;
create policy promo_storage_write on storage.objects for insert to authenticated
  with check (bucket_id = 'promo' and has_permission('promo.manage') and (storage.foldername(name))[1] = current_tenant_id()::text);
drop policy promo_storage_delete on storage.objects;
create policy promo_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'promo' and has_permission('promo.manage') and (storage.foldername(name))[1] = current_tenant_id()::text);

create or replace view member_names with (security_barrier = true) as
select id, tenant_id, full_name, is_active from members
where tenant_id = (select current_tenant_id()) and (select is_active_user()) and (select has_permission('members.lookup'));

drop function is_admin();
drop function is_coach();
drop function is_receptionist();
drop function is_finance();
drop function is_head_coach();
drop function current_app_role();

drop trigger profiles_audit on profiles;

create trigger profiles_audit after update of role, org_role_id, is_active on profiles
  for each row execute function audit_staff_profile_change();

alter table profiles drop column is_head_coach;
