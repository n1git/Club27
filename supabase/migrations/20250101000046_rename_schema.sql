-- tables and views
alter table tenants rename to clubs;
alter table tenant_module_overrides rename to club_module_overrides;
alter table members rename to club_members;
alter table profiles rename to club_profiles;
alter table subscriptions rename to member_memberships;
alter table bookings rename to class_bookings;
alter table promo rename to promos;
alter table organization_members rename to organization_users;
alter table organization_member_clubs rename to organization_user_clubs;
alter view platform_tenant_usage rename to platform_club_usage;
alter view subscription_usage rename to membership_usage;
alter view my_subscription_usage rename to my_membership_usage;

-- columns
alter table audit_log rename column tenant_id to club_id;
alter table class_bookings rename column tenant_id to club_id;
alter table cash_ledger rename column tenant_id to club_id;
alter view cash_ledger_with_balance rename column tenant_id to club_id;
alter table checkin_points rename column tenant_id to club_id;
alter table checkins rename column tenant_id to club_id;
alter table class_types rename column tenant_id to club_id;
alter table classes rename column tenant_id to club_id;
alter table club_type_presets rename column sort to sort_order;
alter table club_types rename column sort to sort_order;
alter table coach_certifications rename column tenant_id to club_id;
alter table consents rename column tenant_id to club_id;
alter view instructors rename column tenant_id to club_id;
alter table invitations rename column tenant_id to club_id;
alter table invoices rename column tenant_id to club_id;
alter table locations rename column tenant_id to club_id;
alter view member_names rename column tenant_id to club_id;
alter table club_members rename column tenant_id to club_id;
alter table membership_packages rename column billing_cycle to billing_period;
alter table membership_packages rename column tenant_id to club_id;
alter table order_counters rename column tenant_id to club_id;
alter table order_items rename column tenant_id to club_id;
alter table order_payments rename column tenant_id to club_id;
alter table orders rename column tenant_id to club_id;
alter table organization_user_clubs rename column tenant_id to club_id;
alter table payroll_runs rename column tenant_id to club_id;
alter table platform_modules rename column sort to sort_order;
alter view platform_organization_usage rename column internal_users to seats_used;
alter view platform_club_usage rename column tenant_id to club_id;
alter table products rename column tenant_id to club_id;
alter table club_profiles rename column tenant_id to club_id;
alter table promos rename column tenant_id to club_id;
alter table resource_bookings rename column tenant_id to club_id;
alter table resource_hours rename column tenant_id to club_id;
alter table resources rename column tenant_id to club_id;
alter table subscription_plans rename column price_per_user_month to price_per_seat_month;
alter view membership_usage rename column tenant_id to club_id;
alter table member_memberships rename column tenant_id to club_id;
alter table club_module_overrides rename column tenant_id to club_id;

-- functions: renames
alter function create_tenant_row(p_org uuid, p_name text, p_club_type text) rename to create_club_row;
alter function current_tenant_id() rename to current_club_id;
alter function enforce_cash_ledger_tenant() rename to enforce_cash_ledger_club;
alter function enforce_invoices_tenant() rename to enforce_invoices_club;
alter function enforce_org_max_tenants() rename to enforce_org_club_limit;
alter function enforce_same_tenant_refs() rename to enforce_same_club_refs;
alter function enforce_subscriptions_tenant() rename to enforce_subscriptions_club;
alter function enforce_tenant_billing_gate() rename to enforce_club_billing_gate;
alter function organization_internal_users(p_org uuid) rename to organization_seats_used;

-- functions: recreate with the new names
drop function accept_invitation(p_token_hash text, p_account_id uuid);
CREATE FUNCTION public.accept_invitation(p_token_hash text, p_account_id uuid)
 RETURNS TABLE(out_kind text, out_organization_id uuid, out_club_id uuid, out_profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  from organization_users m where m.organization_id = i.organization_id and m.account_id = a.id;

  if i.kind = 'staff' then
    select * into r from organization_roles where id = i.org_role_id;
    if exists (select 1 from club_profiles p where p.club_id = i.club_id and p.account_id = a.id) then
      raise exception using errcode = 'IV003', message = 'Akun ini sudah terhubung ke klub ini';
    end if;
    if r.is_paid and (v_base is null or v_base = 'staff') then
      if v_member is null then
        insert into organization_users (organization_id, account_id, email, full_name, base_role)
        values (i.organization_id, a.id, a.email, a.full_name, 'staff') returning id into v_member;
      else
        update organization_users set is_active = true where id = v_member and not is_active;
      end if;
      insert into organization_user_clubs (member_id, club_id) values (v_member, i.club_id) on conflict do nothing;
    end if;
    insert into club_profiles (club_id, role, org_role_id, full_name, email, account_id)
    values (i.club_id, 'staff', i.org_role_id, a.full_name, a.email, a.id) returning id into v_profile;
    out_club_id := i.club_id;
  else
    if v_member is null then
      insert into organization_users (organization_id, account_id, email, full_name, base_role)
      values (i.organization_id, a.id, a.email, a.full_name, 'owner') returning id into v_member;
    elsif v_base = 'staff' then
      delete from organization_user_clubs where member_id = v_member;
      update organization_users set base_role = 'owner', is_active = true where id = v_member;
    elsif v_base not in ('p_owner', 'owner') then
      raise exception 'unexpected member role';
    else
      update organization_users set is_active = true where id = v_member and not is_active;
    end if;
    for t in select id from clubs where organization_id = i.organization_id loop
      if exists (select 1 from club_profiles p where p.club_id = t.id and p.account_id = a.id and p.owner_id is distinct from v_member) then
        raise exception using errcode = 'IV003', message = 'Akun ini sudah punya akses staf di klub organisasi. Nonaktifkan akses itu lebih dulu.';
      end if;
      insert into club_profiles (club_id, role, full_name, email, owner_id, account_id)
      values (t.id, 'owner', a.full_name, a.email, v_member, a.id)
      on conflict (owner_id, club_id) where owner_id is not null do update set is_active = true;
    end loop;
    select p.id into v_profile from club_profiles p where p.owner_id = v_member order by p.created_at limit 1;
    out_club_id := null;
  end if;

  update invitations set status = 'accepted', accepted_account_id = a.id, accepted_at = now() where id = i.id;
  out_kind := i.kind;
  out_organization_id := i.organization_id;
  out_profile_id := v_profile;
  return next;
end;
$function$;
revoke execute on function accept_invitation(p_token_hash text, p_account_id uuid) from public, anon, authenticated;
grant execute on function accept_invitation(p_token_hash text, p_account_id uuid) to service_role;
CREATE OR REPLACE FUNCTION public.activate_member_account(p_member_id uuid, p_account_id uuid)
 RETURNS TABLE(out_account_id uuid, out_profile_id uuid, out_created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member club_members%rowtype;
  v_account accounts%rowtype;
  v_profile uuid;
  v_created boolean;
begin
  select * into v_member from club_members where id = p_member_id for update;
  if v_member.id is null then
    raise exception 'member not found';
  end if;
  if not club_has_module(v_member.club_id, 'member_portal') then
    raise exception using errcode = 'MP003', message = 'Modul portal anggota belum tersedia';
  end if;
  if not v_member.is_active then
    raise exception using errcode = 'MP004', message = 'Anggota nonaktif tidak dapat diaktifkan';
  end if;
  if v_member.profile_id is not null then
    raise exception using errcode = 'MP002', message = 'Akun anggota ini sudah diaktifkan';
  end if;

  select * into v_account from accounts where id = p_account_id and is_active;
  if v_account.id is null then
    raise exception 'account not found';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_account.email));

  v_created := not exists (select 1 from club_profiles where account_id = v_account.id and role = 'member');

  if exists (select 1 from club_profiles where account_id = v_account.id and club_id = v_member.club_id) then
    raise exception using errcode = 'MP001', message = 'Email ini sudah dipakai anggota lain di klub ini';
  end if;

  insert into club_profiles (club_id, role, full_name, email, account_id)
  values (v_member.club_id, 'member', v_member.full_name, v_account.email, v_account.id)
  returning id into v_profile;

  update club_members set profile_id = v_profile where id = p_member_id;

  return query select v_account.id, v_profile, v_created;
end;
$function$;
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
  if not club_has_module(current_club_id(), 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  select * into o from orders where id = p_order_id and club_id = current_club_id() for update;
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
$function$;
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
    where client_request_id = p_request_id and order_id = p_order_id and club_id = current_club_id()
  ) then
    select status into v_status from orders where id = p_order_id;
    return v_status;
  end if;
  perform set_config('club27.payment_request', p_request_id::text, true);
  v_status := add_order_payment(p_order_id, p_method, p_amount, p_reference);
  perform set_config('club27.payment_request', '', true);
  return v_status;
end;
$function$;
CREATE OR REPLACE FUNCTION public.anonymise_member(p_member_id uuid, p_reason text, p_confirm text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m club_members%rowtype;
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
  select * into m from club_members where id = p_member_id and club_id = current_club_id() for update;
  if m.id is null then
    raise exception using errcode = 'AN003', message = 'Anggota tidak ditemukan';
  end if;

  perform set_config('club27.audit_suppress', 'on', true);

  update club_members set
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
    update resource_bookings set created_by = null where created_by = m.profile_id;
    delete from club_profiles where id = m.profile_id;
  end if;

  update class_bookings set notes = null where member_id = m.id;
  update orders set customer_name = null where member_id = m.id;
  update resource_bookings set guest_name = null, guest_phone = null where member_id = m.id;
  update consents set guardian_name = null where subject_type = 'member' and subject_id = m.id;

  perform set_config('club27.audit_suppress', '', true);
  perform log_audit('member.anonymise', 'member', m.id, jsonb_build_object('reason', v_reason), m.club_id);
end;
$function$;
CREATE OR REPLACE FUNCTION public.audit_invoice_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform log_audit(case new.status when 'paid' then 'invoice.paid' else 'invoice.void' end, 'invoice', new.id,
    jsonb_build_object('amount', new.amount), new.club_id);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.audit_member_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform log_audit(case when new.is_active then 'member.activate' else 'member.deactivate' end, 'member', new.id, '{}'::jsonb, new.club_id);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.audit_order_void()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform log_audit('order.void', 'order', new.id,
    jsonb_build_object('number', new.number, 'total', new.total, 'reason', new.void_reason), new.club_id);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.audit_staff_profile_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role = 'member' then
    return new;
  end if;
  if new.org_role_id is distinct from old.org_role_id then
    perform log_audit('staff.role', 'profile', new.id,
      jsonb_build_object(
        'from', (select name from organization_roles where id = old.org_role_id),
        'to', (select name from organization_roles where id = new.org_role_id)
      ), new.club_id);
  end if;
  if new.is_active is distinct from old.is_active then
    perform log_audit(case when new.is_active then 'staff.activate' else 'staff.deactivate' end, 'profile', new.id, '{}'::jsonb, new.club_id);
  end if;
  return new;
end;
$function$;
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
  insert into class_bookings (member_id, class_id, is_attended, attended_at)
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
$function$;
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
  if not club_has_module(current_club_id(), 'resource_booking') then
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
$function$;
CREATE OR REPLACE FUNCTION public.book_resource_as_member(p_resource_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member uuid;
  v_advance int;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not is_member() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  v_member := current_member_id();
  if not club_has_module(current_club_id(), 'resource_booking') or not club_has_module(current_club_id(), 'member_portal') then
    raise exception using errcode = 'RB003', message = 'Booking mandiri belum tersedia di klub ini';
  end if;
  if not exists (
    select 1 from member_memberships
    where member_id = v_member and status = 'active'
      and start_date <= v_today and (end_date is null or end_date >= v_today)
  ) then
    raise exception using errcode = 'RB006', message = 'Anda belum punya paket aktif';
  end if;
  select advance_days into v_advance from resources where id = p_resource_id and club_id = current_club_id();
  if v_advance is null then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  if p_start <= now() or p_start > now() + make_interval(days => v_advance) then
    raise exception using errcode = 'RB004', message = format('Booking hanya bisa untuk waktu yang akan datang, maksimal %s hari ke depan', v_advance);
  end if;
  if exists (
    select 1 from resource_bookings
    where resource_id = p_resource_id and member_id = v_member and status = 'confirmed'
      and start_time < p_end and end_time > p_start
  ) then
    raise exception using errcode = 'RB008', message = 'Anda sudah punya booking pada slot ini';
  end if;
  return resource_booking_insert(p_resource_id, p_start, p_end, v_member, null, null, 'member');
end;
$function$;
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
  if not club_has_module(current_club_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  select * into b from resource_bookings where id = p_booking_id and club_id = current_club_id() for update;
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
$function$;
CREATE OR REPLACE FUNCTION public.cancel_organization_deletion(p_org uuid, p_actor_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_account uuid;
  v_prev text;
begin
  select account_id into v_owner_account
  from organization_users where organization_id = p_org and base_role = 'p_owner' and is_active for update;
  if v_owner_account is null or v_owner_account is distinct from p_actor_account then
    raise exception using errcode = 'OW001', message = 'Hanya pemilik utama yang dapat memulihkan organisasi';
  end if;
  select deletion_previous_status into v_prev
  from organizations where id = p_org and deletion_requested_at is not null and purge_after > now() for update;
  if not found then
    raise exception using errcode = 'DL002', message = 'Tidak ada penghapusan yang bisa dibatalkan';
  end if;
  update organizations set
    deletion_requested_at = null, deletion_requested_by = null, purge_after = null, deletion_previous_status = null
  where id = p_org;
  perform set_organization_status(p_org, coalesce(v_prev, 'active'), 'pemulihan oleh pemilik');
end;
$function$;
CREATE OR REPLACE FUNCTION public.check_member_profile_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role = 'member'
     and not exists (select 1 from club_members where profile_id = new.id and club_id = new.club_id) then
    raise exception 'member profile must be linked to a member of the same club';
  end if;
  return null;
end;
$function$;
CREATE OR REPLACE FUNCTION public.check_one_p_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
begin
  if exists (select 1 from organization_users where organization_id = v_org)
     and (select count(*) from organization_users where organization_id = v_org and base_role = 'p_owner') <> 1 then
    raise exception using errcode = '23514', message = 'Organisasi harus punya tepat satu pemilik utama';
  end if;
  return null;
end;
$function$;
CREATE OR REPLACE FUNCTION public.checkin_core(p_member_id uuid, p_point_id uuid, p_method text, p_actor uuid)
 RETURNS TABLE(out_checkin_id uuid, out_checked_in_at timestamp with time zone, out_already boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member club_members%rowtype;
  v_sub member_memberships%rowtype;
  v_pkg membership_packages%rowtype;
  v_existing checkins%rowtype;
  v_used int;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_id uuid;
  v_at timestamptz;
begin
  select * into v_member from club_members where id = p_member_id;
  if v_member.id is null then
    raise exception using errcode = 'CK002', message = 'Keanggotaan Anda tidak aktif';
  end if;
  if not club_has_module(v_member.club_id, 'checkin') then
    raise exception using errcode = 'CK001', message = 'Check-in belum tersedia di klub ini';
  end if;
  if not v_member.is_active then
    raise exception using errcode = 'CK002', message = 'Keanggotaan Anda tidak aktif';
  end if;

  perform pg_advisory_xact_lock(hashtext('checkin:' || p_member_id::text));

  select * into v_existing from checkins
  where member_id = p_member_id and checked_in_at > now() - interval '120 minutes'
  order by checked_in_at desc limit 1;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.checked_in_at, true;
    return;
  end if;

  select * into v_sub from member_memberships
  where member_id = p_member_id and status = 'active'
    and start_date <= v_today and (end_date is null or end_date >= v_today)
  limit 1;
  if v_sub.id is null then
    raise exception using errcode = 'CK003', message = 'Anda belum punya paket aktif';
  end if;

  select * into v_pkg from membership_packages where id = v_sub.package_id;
  if v_pkg.pricing_mode = 'session_pack' then
    select count(*) into v_used from checkins where subscription_id = v_sub.id;
    if v_used >= v_pkg.sessions_included then
      raise exception using errcode = 'CK004', message = 'Sesi paket Anda sudah habis';
    end if;
  end if;

  insert into checkins (club_id, member_id, point_id, method, subscription_id, created_by)
  values (v_member.club_id, p_member_id, p_point_id, p_method, v_sub.id, p_actor)
  returning id, checked_in_at into v_id, v_at;

  return query select v_id, v_at, false;
end;
$function$;
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
    select 1 from checkin_points where id = p_point_id and club_id = current_club_id() and is_active
  ) then
    raise exception 'point not found';
  end if;
  return checkin_token_for(p_point_id, checkin_window(0));
end;
$function$;
drop function club_has_module(p_tenant uuid, p_module text);
CREATE FUNCTION public.club_has_module(p_club uuid, p_module text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from platform_modules pm
    join clubs t on t.id = p_club
    where pm.code = p_module
      and pm.status = 'ready'
      and (
        p_module = 'members'
        or coalesce(
          (select o.enabled from club_module_overrides o where o.club_id = p_club and o.module_code = p_module),
          exists (select 1 from club_type_modules m where m.club_type = t.club_type and m.module_code = p_module)
        )
      )
  );
$function$;
revoke execute on function club_has_module(p_club uuid, p_module text) from public, anon, authenticated;
grant execute on function club_has_module(p_club uuid, p_module text) to service_role;
CREATE OR REPLACE FUNCTION public.coach_owns_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from classes cl
    join club_profiles p on p.id = auth.uid() and p.is_active
    where cl.id = p_class_id
      and cl.club_id = current_club_id()
      and coalesce(cl.substitute_id, cl.instructor_id) = auth.uid()
  );
$function$;
CREATE OR REPLACE FUNCTION public.coach_owns_member(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from club_members m
    join club_profiles p on p.id = m.coach_id
    where m.id = p_member_id
      and m.coach_id = auth.uid()
      and m.club_id = current_club_id()
      and p.is_active
  );
$function$;
CREATE OR REPLACE FUNCTION public.coach_substitutes_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from classes cl
    join club_profiles p on p.id = auth.uid() and p.is_active
    where cl.id = p_class_id
      and cl.club_id = current_club_id()
      and cl.substitute_id = auth.uid()
  );
$function$;
CREATE OR REPLACE FUNCTION public.coach_substitutes_member(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from class_bookings b
    join classes cl on cl.id = b.class_id
    join club_profiles p on p.id = auth.uid() and p.is_active
    where b.member_id = p_member_id
      and cl.club_id = current_club_id()
      and cl.substitute_id = auth.uid()
  );
$function$;
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
  update clubs set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = current_club_id();
end;
$function$;
CREATE OR REPLACE FUNCTION public.confirm_renewal(p_renewal_id uuid, p_actor text, p_provider text DEFAULT 'manual'::text, p_provider_ref text DEFAULT NULL::text)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r subscription_renewals%rowtype;
  s organization_subscriptions%rowtype;
  v_end date;
  v_start date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_seats int;
  v_pending int;
  v_used int;
begin
  select * into r from subscription_renewals where id = p_renewal_id for update;
  if r.id is null then
    raise exception 'renewal not found';
  end if;
  if r.status = 'paid' then
    return r.period_end;
  end if;
  if r.status = 'cancelled' and coalesce(p_provider, 'manual') = 'manual' then
    raise exception using errcode = '22023', message = 'Pengajuan sudah dibatalkan';
  end if;

  select * into s from organization_subscriptions where organization_id = r.organization_id for update;

  if r.kind = 'seats' then
    v_seats := s.seats + r.seats_added;
    v_pending := case when s.pending_seats is null then null else s.pending_seats + r.seats_added end;
    if v_pending is not null and v_pending >= v_seats then
      v_pending := null;
    end if;
    update organization_subscriptions set
      seats = v_seats,
      pending_seats = v_pending,
      pending_seats_from = case when v_pending is null then null else pending_seats_from end
    where organization_id = r.organization_id;
    update subscription_renewals set
      status = 'paid',
      paid_at = now(),
      confirmed_by = p_actor,
      provider = coalesce(p_provider, 'manual'),
      provider_ref = p_provider_ref,
      period_start = s.current_period_start,
      period_end = s.current_period_end
    where id = r.id;
    return s.current_period_end;
  end if;

  v_start := case when s.status = 'active' and s.current_period_end is not null and s.current_period_end >= v_today then s.current_period_end + 1 else v_today end;

  update organization_subscriptions set plan_code = r.plan_code, billing_period = r.billing_period
  where organization_id = r.organization_id;
  perform set_organization_status(r.organization_id, 'active', p_actor, v_start, null);
  select current_period_end into v_end from organization_subscriptions where organization_id = r.organization_id;

  v_used := organization_seats_used(r.organization_id);
  if v_start > v_today and r.users < s.seats then
    v_pending := greatest(r.users, v_used);
    update organization_subscriptions set
      pending_seats = case when v_pending < s.seats then v_pending end,
      pending_seats_from = case when v_pending < s.seats then v_start end
    where organization_id = r.organization_id;
  else
    update organization_subscriptions set
      seats = greatest(r.users, v_used),
      pending_seats = null,
      pending_seats_from = null
    where organization_id = r.organization_id;
  end if;

  update subscription_renewals set
    status = 'paid',
    paid_at = now(),
    confirmed_by = p_actor,
    provider = coalesce(p_provider, 'manual'),
    provider_ref = p_provider_ref,
    period_start = v_start,
    period_end = v_end
  where id = r.id;
  return v_end;
end;
$function$;
drop function create_invitation(p_org uuid, p_tenant uuid, p_kind text, p_role uuid, p_email text, p_name text, p_token_hash text, p_invited_by uuid);
CREATE FUNCTION public.create_invitation(p_org uuid, p_club uuid, p_kind text, p_role uuid, p_email text, p_name text, p_token_hash text, p_invited_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  perform enforce_billing_gate(p_org);
  if p_kind = 'staff' then
    if not exists (select 1 from clubs where id = p_club and organization_id = p_org)
       or not exists (select 1 from organization_roles where id = p_role and organization_id = p_org) then
      raise exception using errcode = '22023', message = 'Klub atau peran tidak valid';
    end if;
    if exists (select 1 from club_profiles p join accounts a on a.id = p.account_id where p.club_id = p_club and a.email = v_email) then
      raise exception using errcode = 'IV001', message = 'Email ini sudah terhubung ke klub ini';
    end if;
    update invitations set status = 'revoked' where club_id = p_club and email = v_email and status = 'pending' and kind = 'staff';
  elsif p_kind = 'owner' then
    if p_club is not null or p_role is not null then
      raise exception using errcode = '22023', message = 'Undangan pemilik tidak memakai klub atau peran';
    end if;
    if exists (
      select 1 from organization_users m where m.organization_id = p_org and m.email = v_email and m.is_active and m.base_role in ('p_owner', 'owner')
    ) then
      raise exception using errcode = 'IV001', message = 'Email ini sudah menjadi pemilik organisasi';
    end if;
    update invitations set status = 'revoked' where organization_id = p_org and email = v_email and status = 'pending' and kind = 'owner';
  else
    raise exception using errcode = '22023', message = 'Jenis undangan tidak valid';
  end if;

  insert into invitations (organization_id, club_id, kind, org_role_id, email, full_name, token_hash, expires_at, invited_by)
  values (p_org, p_club, p_kind, p_role, v_email, btrim(p_name), p_token_hash, now() + interval '7 days', p_invited_by)
  returning id into v_id;
  return v_id;
end;
$function$;
revoke execute on function create_invitation(p_org uuid, p_club uuid, p_kind text, p_role uuid, p_email text, p_name text, p_token_hash text, p_invited_by uuid) from public, anon, authenticated;
grant execute on function create_invitation(p_org uuid, p_club uuid, p_kind text, p_role uuid, p_email text, p_name text, p_token_hash text, p_invited_by uuid) to service_role;
CREATE OR REPLACE FUNCTION public.create_invoice_for_session_pack_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_price numeric(12, 2);
  v_pricing_mode text;
begin
  select price, pricing_mode into v_price, v_pricing_mode
  from membership_packages
  where id = new.package_id;

  if v_pricing_mode <> 'session_pack' then
    return new;
  end if;

  insert into invoices (club_id, member_id, subscription_id, amount, due_date, period_start, period_end)
  values (new.club_id, new.member_id, new.id, v_price, new.start_date, new.start_date, new.end_date)
  on conflict (subscription_id, period_start) do nothing;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.create_order(p_member_id uuid, p_customer_name text, p_items jsonb, p_payments jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_club uuid := current_club_id();
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
  if not club_has_module(v_club, 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = 'PS002', message = 'Pesanan harus berisi 1 sampai 100 item';
  end if;
  if p_member_id is not null and not exists (
    select 1 from club_members where id = p_member_id and club_id = v_club and is_active
  ) then
    raise exception using errcode = 'PS002', message = 'Anggota tidak ditemukan';
  end if;

  insert into orders (club_id, number, member_id, customer_name, created_by)
  values (v_club, next_order_number(v_club), p_member_id, nullif(trim(coalesce(p_customer_name, '')), ''), auth.uid())
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_kind := v_item ->> 'kind';
    v_qty := coalesce((v_item ->> 'qty')::int, 1);
    if v_qty < 1 or v_qty > 9999 then
      raise exception using errcode = 'PS002', message = 'Jumlah item tidak valid';
    end if;
    if v_kind = 'product' then
      select * into p from products
      where id = (v_item ->> 'product_id')::uuid and club_id = v_club and is_active;
      if p.id is null then
        raise exception using errcode = 'PS002', message = 'Produk tidak ditemukan atau nonaktif';
      end if;
      insert into order_items (order_id, club_id, kind, product_id, description, qty, unit_price, line_total)
      values (v_order, v_club, 'product', p.id, p.name, v_qty, p.price, round(p.price * v_qty, 2));
      v_total := v_total + round(p.price * v_qty, 2);
    elsif v_kind = 'booking' then
      select * into b from resource_bookings
      where id = (v_item ->> 'booking_id')::uuid and club_id = v_club for update;
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
      insert into order_items (order_id, club_id, kind, booking_id, description, qty, unit_price, line_total)
      values (v_order, v_club, 'booking', b.id, v_desc, 1, b.price, b.price);
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
$function$;
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
  select id into v_id from orders where client_request_id = p_request_id and club_id = current_club_id();
  if v_id is not null then
    return v_id;
  end if;
  perform set_config('club27.order_request', p_request_id::text, true);
  v_id := create_order(p_member_id, p_customer_name, p_items, p_payments);
  perform set_config('club27.order_request', '', true);
  return v_id;
end;
$function$;
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
  v_club_id uuid;
begin
  if not (has_permission('payroll.manage')) then
    raise exception 'forbidden';
  end if;

  v_club_id := current_club_id();

  if not exists (
    select 1 from club_profiles where id = p_coach_id and is_instructor(id) and club_id = v_club_id
  ) then
    raise exception 'coach not found in this club';
  end if;

  insert into payroll_runs (club_id, coach_id, period_start, period_end, base_salary, bonus, thr, status)
  values (v_club_id, p_coach_id, p_period_start, p_period_end, p_base_salary, p_bonus, p_thr, 'draft')
  returning id, total_amount into v_run_id, v_total;

  insert into cash_ledger (club_id, category, direction, amount, payroll_run_id, created_by)
  values (v_club_id, 'payroll', 'out', v_total, v_run_id, auth.uid())
  returning id into v_ledger_id;

  update payroll_runs
  set cash_ledger_entry_id = v_ledger_id, status = 'posted', posted_at = now()
  where id = v_run_id;

  return v_run_id;
end;
$function$;
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
  if not club_has_module(current_club_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;

  insert into resources (club_id, location_id, name, kind, capacity, slot_minutes, price_per_slot, advance_days, cancel_hours)
  values (current_club_id(), p_location_id, trim(p_name), p_kind, p_capacity, p_slot_minutes, p_price_per_slot, p_advance_days, p_cancel_hours)
  returning id into v_id;

  insert into resource_hours (resource_id, club_id, weekday, opens, closes)
  select v_id, current_club_id(), d, p_opens, p_closes from generate_series(0, 6) d;

  return v_id;
end;
$function$;
drop function create_tenant_for_owner(p_owner_id uuid, p_tenant_name text, p_club_type text);
CREATE FUNCTION public.create_club_for_owner(p_owner_id uuid, p_club_name text, p_club_type text DEFAULT 'swimming'::text)
 RETURNS TABLE(club_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner organization_users%rowtype;
  v_club uuid;
  v_profile uuid;
  o record;
begin
  select * into v_owner from organization_users where id = p_owner_id and is_active and base_role in ('p_owner', 'owner');
  if v_owner.id is null or v_owner.account_id is null then
    raise exception 'owner not found';
  end if;

  v_club := create_club_row(v_owner.organization_id, p_club_name, p_club_type);

  for o in
    select id, account_id, email, full_name from organization_users
    where organization_id = v_owner.organization_id and is_active and base_role in ('p_owner', 'owner') and account_id is not null
  loop
    insert into club_profiles (club_id, role, full_name, email, owner_id, account_id)
    values (v_club, 'owner', o.full_name, o.email, o.id, o.account_id) returning id into v_profile;
    if o.id = v_owner.id then
      profile_id := v_profile;
    end if;
  end loop;

  club_id := v_club;
  return next;
end;
$function$;
revoke execute on function create_club_for_owner(p_owner_id uuid, p_club_name text, p_club_type text) from public, anon, authenticated;
grant execute on function create_club_for_owner(p_owner_id uuid, p_club_name text, p_club_type text) to service_role;
CREATE OR REPLACE FUNCTION public.create_club_row(p_org uuid, p_name text, p_club_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_club uuid;
  v_slug text;
begin
  if not exists (select 1 from club_types where code = p_club_type and status = 'ready') then
    raise exception 'club type not available';
  end if;
  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'klub'), 30) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  insert into clubs (organization_id, name, slug, club_type) values (p_org, p_name, v_slug, p_club_type) returning id into v_club;
  return v_club;
end;
$function$;
CREATE OR REPLACE FUNCTION public.current_club_has_module(p_module text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select club_has_module(current_club_id(), p_module);
$function$;
CREATE OR REPLACE FUNCTION public.current_club_modules()
 RETURNS TABLE(code text, name text, description text, status text, in_type boolean, override boolean, effective boolean, sort integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    pm.code,
    pm.name,
    pm.description,
    pm.status,
    exists (
      select 1 from clubs t join club_type_modules m on m.club_type = t.club_type
      where t.id = current_club_id() and m.module_code = pm.code
    ),
    (select o.enabled from club_module_overrides o where o.club_id = current_club_id() and o.module_code = pm.code),
    club_has_module(current_club_id(), pm.code),
    pm.sort_order
  from platform_modules pm
  order by pm.sort_order;
$function$;
CREATE OR REPLACE FUNCTION public.current_member_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id from club_members m
  where m.profile_id = auth.uid() and m.club_id = current_club_id() and m.is_active
$function$;
CREATE OR REPLACE FUNCTION public.current_profile_is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from club_profiles where id = auth.uid() and owner_id is not null);
$function$;
CREATE OR REPLACE FUNCTION public.current_profile_kind()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role from club_profiles where id = auth.uid() and club_id = current_club_id()), '');
$function$;
CREATE OR REPLACE FUNCTION public.current_club_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select nullif(auth.jwt() ->> 'club_id', '')::uuid
$function$;
CREATE OR REPLACE FUNCTION public.discard_unverified_registration(p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_clubs uuid[];
  v_account uuid;
begin
  select o.organization_id, o.account_id into v_org, v_account
  from organization_users o join organization_subscriptions s on s.organization_id = o.organization_id
  where o.email = lower(trim(p_email)) and s.status = 'pending_verification';
  if v_org is null then
    return false;
  end if;
  select array_agg(id) into v_clubs from clubs where organization_id = v_org;
  if exists (select 1 from club_profiles where club_id = any(v_clubs) and owner_id is null)
     or exists (select 1 from club_members where club_id = any(v_clubs))
     or (select count(*) from clubs where organization_id = v_org) > 1 then
    raise exception 'registration already has data';
  end if;
  delete from email_verifications where organization_id = v_org;
  delete from club_profiles where club_id = any(v_clubs);
  delete from clubs where organization_id = v_org;
  delete from organization_users where organization_id = v_org;
  delete from organization_subscriptions where organization_id = v_org;
  delete from organizations where id = v_org;
  if v_account is not null and not exists (select 1 from club_profiles where account_id = v_account) then
    delete from accounts where id = v_account and email_verified_at is null;
  end if;
  return true;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_billing_gate(p_org uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_phase text := subscription_phase(p_org);
begin
  if v_phase is null or v_phase in ('trial', 'active') then
    return;
  end if;
  if not exists (select 1 from clubs where organization_id = p_org) then
    return;
  end if;
  if v_phase = 'unverified' then
    raise exception using errcode = 'SW003',
      message = 'Email pendaftaran belum diverifikasi. Buka tautan verifikasi yang dikirim ke email pemilik.';
  elsif v_phase = 'pending' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi belum aktif. Pemilik dapat mengajukan aktivasi di halaman Langganan.';
  elsif v_phase = 'suspended' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sedang ditangguhkan atau dibatalkan. Hubungi admin platform 27 Club.';
  elsif v_phase = 'grace' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sudah berakhir dan data hanya bisa dibaca. Pemilik dapat memperpanjang di halaman Langganan.';
  else
    raise exception using errcode = 'SW003',
      message = 'Masa tenggang langganan organisasi sudah berakhir. Pemilik dapat memperpanjang di halaman Langganan.';
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_capacity int;
  v_count int;
  v_member_club_id uuid;
  v_class_club_id uuid;
begin
  select capacity, club_id into v_capacity, v_class_club_id from classes where id = new.class_id for update;
  if v_capacity is null then
    raise exception 'class not found';
  end if;
  select club_id into v_member_club_id from club_members where id = new.member_id;
  if v_member_club_id is null or v_member_club_id <> v_class_club_id or new.club_id <> v_class_club_id then
    raise exception 'member and class must belong to the same club as the booking';
  end if;
  select count(*) into v_count from class_bookings where class_id = new.class_id;
  if v_count >= v_capacity then
    raise exception 'class is full';
  end if;
  return new;
end;
$function$;
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
      jsonb_build_object('class_id', new.class_id, 'member_id', new.member_id), new.club_id);
    return new;
  end if;
  select start_time into v_start from classes where id = new.class_id;
  if v_start <= now() then
    raise exception using errcode = 'BK001', message = 'Kelas sudah dimulai, anggota tidak bisa didaftarkan lagi';
  end if;
  v_day := (v_start at time zone 'Asia/Jakarta')::date;
  if not exists (
    select 1 from member_memberships
    where member_id = new.member_id and status = 'active'
      and start_date <= v_day and (end_date is null or end_date >= v_day)
  ) then
    raise exception using errcode = 'BK002', message = 'Anggota belum punya paket aktif untuk tanggal kelas ini';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_cash_ledger_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.invoice_id is not null and not exists (
    select 1 from invoices where id = new.invoice_id and club_id = new.club_id
  ) then
    raise exception 'invoice_id must belong to the same club as the cash ledger entry';
  end if;
  if new.payroll_run_id is not null and not exists (
    select 1 from payroll_runs where id = new.payroll_run_id and club_id = new.club_id
  ) then
    raise exception 'payroll_run_id must belong to the same club as the cash ledger entry';
  end if;
  if new.order_id is not null and not exists (
    select 1 from orders where id = new.order_id and club_id = new.club_id
  ) then
    raise exception 'order_id must belong to the same club as the cash ledger entry';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_checkin_point_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.location_id is not null and not exists (
    select 1 from locations where id = new.location_id and club_id = new.club_id
  ) then
    raise exception 'location_id must belong to the same club';
  end if;
  return new;
end;
$function$;
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
      select 1 from club_profiles
      where id = new.substitute_id and is_instructor(id) and is_active and club_id = new.club_id
    ) then
      raise exception 'substitute_id must reference an active coach in the same club';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('class-teacher:' || v_teacher::text));

  if exists (
    select 1 from classes c
    where c.id <> new.id
      and c.club_id = new.club_id
      and coalesce(c.substitute_id, c.instructor_id) = v_teacher
      and tstzrange(c.start_time, c.end_time, '[)') && tstzrange(new.start_time, new.end_time, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'coach already teaches another class at this time';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_classes_instructor_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from club_profiles
    where id = new.instructor_id and is_instructor(id) and club_id = new.club_id
  ) then
    raise exception 'instructor_id must reference an instructor profile in the same club';
  end if;
  if not exists (select 1 from locations where id = new.location_id and club_id = new.club_id) then
    raise exception 'location_id must belong to the same club';
  end if;
  if not exists (select 1 from class_types where id = new.class_type_id and club_id = new.club_id) then
    raise exception 'class_type_id must belong to the same club';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_coach_certification_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from club_profiles where id = new.coach_id and is_instructor(id) and club_id = new.club_id
  ) then
    raise exception 'coach_id must reference an instructor profile in the same club';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_invoices_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from club_members where id = new.member_id and club_id = new.club_id) then
    raise exception 'member_id must belong to the same club as the invoice';
  end if;
  if not exists (select 1 from member_memberships where id = new.subscription_id and club_id = new.club_id) then
    raise exception 'subscription_id must belong to the same club as the invoice';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_member_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;
  select organization_id into v_org from clubs where id = new.club_id;
  perform enforce_billing_gate(v_org);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_member_club_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from organization_users m join clubs t on t.organization_id = m.organization_id
    where m.id = new.member_id and t.id = new.club_id and m.base_role = 'staff'
  ) then
    raise exception 'club assignment needs a staff member and a club of the same organization';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_member_profile_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.profile_id is not null and not exists (
    select 1 from club_profiles where id = new.profile_id and role = 'member' and club_id = new.club_id
  ) then
    raise exception 'profile_id must reference a member profile of the same club';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_members_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.preferred_location_id is not null and not exists (
    select 1 from locations where id = new.preferred_location_id and club_id = new.club_id
  ) then
    raise exception 'preferred_location_id must belong to the same club';
  end if;
  if new.coach_id is not null and not exists (
    select 1 from club_profiles where id = new.coach_id and is_instructor(id) and club_id = new.club_id
  ) then
    raise exception 'coach_id must reference an instructor profile in the same club';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_org_club_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_limit int;
  v_count int;
  v_exists boolean;
begin
  select true, coalesce(s.club_limit_override, sp.club_limit) into v_exists, v_limit
  from organization_subscriptions s
  join subscription_plans sp on sp.code = s.plan_code
  where s.organization_id = new.organization_id
  for update of s;

  if v_exists is null then
    return new;
  end if;

  perform enforce_billing_gate(new.organization_id);

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from clubs where organization_id = new.organization_id;
  if v_count >= v_limit then
    raise exception using
      errcode = 'SW004',
      message = format('Batas %s klub untuk paket organisasi ini sudah tercapai. Hubungi admin platform 27club untuk upgrade paket.', v_limit);
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_org_writable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row jsonb;
  v_club uuid;
  v_org uuid;
begin
  if auth.uid() is not null then
    v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    v_club := (v_row ->> 'club_id')::uuid;
    if v_club is not null then
      select organization_id into v_org from clubs where id = v_club;
      if coalesce(subscription_phase(v_org), 'active') not in ('trial', 'active') then
        perform enforce_billing_gate(v_org);
        raise exception using errcode = 'SW003', message = 'Langganan organisasi tidak aktif.';
      end if;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_payroll_coach_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from club_profiles
    where id = new.coach_id and is_instructor(id) and club_id = new.club_id
  ) then
    raise exception 'coach_id must reference an instructor profile in the same club';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_profile_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
begin
  if new.role <> 'staff' or not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active and old.role = 'staff' then
    return new;
  end if;
  select organization_id into v_org from clubs where id = new.club_id;
  perform enforce_billing_gate(v_org);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_profile_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_org uuid;
  v_owner_email text;
  v_owner_role text;
  v_club_org uuid;
begin
  if new.owner_id is not null then
    select organization_id, email, base_role into v_owner_org, v_owner_email, v_owner_role
    from organization_users where id = new.owner_id;
    select organization_id into v_club_org from clubs where id = new.club_id;
    if v_owner_org is distinct from v_club_org
       or v_owner_email is distinct from new.email
       or v_owner_role not in ('p_owner', 'owner') then
      raise exception 'owner profile must belong to a club of the owner organization and use the owner email';
    end if;
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_profile_role_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_role_org uuid;
  v_paid boolean;
begin
  if new.role <> 'staff' then
    return new;
  end if;
  select organization_id into v_org from clubs where id = new.club_id;
  select organization_id, is_paid into v_role_org, v_paid from organization_roles where id = new.org_role_id;
  if v_role_org is distinct from v_org then
    raise exception 'role must belong to the organization of the club';
  end if;
  if v_paid and not exists (
    select 1 from organization_users sm
    join organization_user_clubs c on c.member_id = sm.id and c.club_id = new.club_id
    where sm.account_id = new.account_id and sm.organization_id = v_org and sm.is_active and sm.base_role = 'staff'
  ) then
    raise exception using errcode = '23514', message = 'Role berbayar memerlukan keanggotaan staf pada klub ini';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_resource_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r resources%rowtype;
  hrs resource_hours%rowtype;
  local_start timestamp;
  local_end timestamp;
  start_t time;
  end_t time;
  duration_min numeric;
  offset_min numeric;
begin
  select * into r from resources where id = new.resource_id for update;
  if r.id is null or r.club_id <> new.club_id then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  if new.member_id is not null and not exists (
    select 1 from club_members where id = new.member_id and club_id = new.club_id
  ) then
    raise exception using errcode = 'RB008', message = 'Anggota tidak ditemukan';
  end if;

  if new.status <> 'confirmed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed'
     and old.start_time = new.start_time and old.end_time = new.end_time and old.resource_id = new.resource_id then
    return new;
  end if;

  if new.source <> 'class' then
    local_start := new.start_time at time zone 'Asia/Jakarta';
    local_end := new.end_time at time zone 'Asia/Jakarta';
    if local_end::date > local_start::date and not (local_end::time = time '00:00' and local_end::date = local_start::date + 1) then
      raise exception using errcode = 'RB002', message = 'Booking tidak boleh melewati tengah malam';
    end if;
    select * into hrs from resource_hours where resource_id = r.id and weekday = extract(dow from local_start)::int;
    if hrs.resource_id is null then
      raise exception using errcode = 'RB002', message = 'Fasilitas tutup pada hari tersebut';
    end if;
    start_t := local_start::time;
    end_t := case when local_end::date > local_start::date then time '24:00:00' else local_end::time end;
    if start_t < hrs.opens or end_t > hrs.closes then
      raise exception using errcode = 'RB002', message = 'Waktu di luar jam buka fasilitas';
    end if;
    offset_min := extract(epoch from (start_t - hrs.opens)) / 60;
    duration_min := extract(epoch from (new.end_time - new.start_time)) / 60;
    if mod(offset_min, r.slot_minutes) <> 0 or mod(duration_min, r.slot_minutes) <> 0 then
      raise exception using errcode = 'RB002', message = 'Waktu tidak sesuai kelipatan slot fasilitas';
    end if;
  end if;

  if resource_max_overlap(r.id, new.start_time, new.end_time, new.id) >= r.capacity then
    if new.source = 'class' then
      raise exception using errcode = 'RB007', message = 'Fasilitas sudah terpakai pada waktu kelas ini. Pilih waktu atau fasilitas lain.';
    end if;
    raise exception using errcode = 'RB001', message = 'Slot sudah penuh. Pilih waktu lain.';
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_resource_hours_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from resources where id = new.resource_id and club_id = new.club_id) then
    raise exception 'resource_id must belong to the same club';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_resource_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from locations where id = new.location_id and club_id = new.club_id) then
    raise exception 'location_id must belong to the same club';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_same_club_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_col text;
  v_id uuid;
  v_row jsonb := to_jsonb(new);
begin
  foreach v_col in array tg_argv loop
    v_id := nullif(v_row ->> v_col, '')::uuid;
    continue when v_id is null;
    if v_col = 'cash_ledger_entry_id' then
      if not exists (select 1 from cash_ledger where id = v_id and club_id = new.club_id) then
        raise exception '% must belong to the same club', v_col;
      end if;
    elsif not exists (select 1 from club_profiles where id = v_id and club_id = new.club_id) then
      raise exception '% must belong to the same club', v_col;
    end if;
  end loop;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_seats int;
  v_pending int;
  v_used int;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;
  select seats, pending_seats into v_seats, v_pending
  from organization_subscriptions where organization_id = new.organization_id for update;
  if not found then
    return new;
  end if;
  perform enforce_billing_gate(new.organization_id);
  select count(*) into v_used
  from organization_users
  where organization_id = new.organization_id and is_active and id <> new.id;
  if v_used >= least(v_seats, coalesce(v_pending, v_seats)) then
    raise exception using errcode = 'SW005',
      message = format('Seat penuh: organisasi memakai %s dari %s seat. Tambah seat di halaman Langganan.', v_used, least(v_seats, coalesce(v_pending, v_seats)));
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_subscription_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_limit int;
  v_count int;
begin
  if new.plan_code is not distinct from old.plan_code
     and new.club_limit_override is not distinct from old.club_limit_override then
    return new;
  end if;
  select coalesce(new.club_limit_override, club_limit) into v_limit
  from subscription_plans where code = new.plan_code;
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from clubs where organization_id = new.organization_id;
  if v_count > v_limit then
    raise exception using
      errcode = 'SW004',
      message = format('Organisasi memiliki %s klub, melebihi batas %s klub paket ini.', v_count, v_limit);
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_subscriptions_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from club_members where id = new.member_id and club_id = new.club_id) then
    raise exception 'member_id must belong to the same club as the subscription';
  end if;
  if not exists (select 1 from membership_packages where id = new.package_id and club_id = new.club_id) then
    raise exception 'package_id must belong to the same club as the subscription';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_club_billing_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform enforce_billing_gate((select organization_id from clubs where id = new.club_id));
  return new;
end;
$function$;
drop function generate_invoices_for_period(p_period_start date, p_period_end date, p_due_date date, p_tenant_id uuid);
CREATE FUNCTION public.generate_invoices_for_period(p_period_start date, p_period_end date, p_due_date date, p_club_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_club_id is not null then
    perform enforce_billing_gate((select organization_id from clubs where id = p_club_id));
  end if;
  return query
  insert into invoices (club_id, member_id, subscription_id, amount, due_date, period_start, period_end)
  select s.club_id, s.member_id, s.id, mp.price, p_due_date, p_period_start, p_period_end
  from member_memberships s
  join membership_packages mp on mp.id = s.package_id
  join club_members m on m.id = s.member_id
  join clubs t on t.id = s.club_id
  left join organization_subscriptions os on os.organization_id = t.organization_id
  where s.status = 'active'
    and mp.pricing_mode = 'cycle'
    and m.is_active
    and t.is_active
    and (
      os.status is null
      or os.status = 'active'
      or (os.status = 'trial' and os.trial_ends_at >= (now() at time zone 'Asia/Jakarta')::date)
    )
    and s.start_date <= p_period_end
    and (s.end_date is null or s.end_date >= p_period_start)
    and (p_club_id is null or s.club_id = p_club_id)
  on conflict (subscription_id, period_start) do nothing
  returning *;
end;
$function$;
revoke execute on function generate_invoices_for_period(p_period_start date, p_period_end date, p_due_date date, p_club_id uuid) from public, anon, authenticated;
grant execute on function generate_invoices_for_period(p_period_start date, p_period_end date, p_due_date date, p_club_id uuid) to service_role;
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select is_active_user() and exists (
    select 1
    from club_profiles p
    join clubs t on t.id = p.club_id
    left join organization_users om on om.id = p.owner_id
    left join organization_roles r on r.id = p.org_role_id
    where p.id = auth.uid()
      and p.club_id = current_club_id()
      and (
        (p.role = 'owner' and om.is_active and om.base_role in ('p_owner', 'owner'))
        or (
          p.role = 'staff'
          and exists (select 1 from role_permissions rp where rp.role_id = p.org_role_id and rp.permission_code = p_code)
          and (
            not r.is_paid
            or exists (
              select 1
              from organization_users sm
              join organization_user_clubs c on c.member_id = sm.id and c.club_id = p.club_id
              where sm.account_id = p.account_id
                and sm.organization_id = t.organization_id
                and sm.is_active
                and sm.base_role in ('staff', 'owner', 'p_owner')
            )
          )
        )
      )
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_active_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from club_profiles p
    join clubs t on t.id = p.club_id and t.is_active
    join accounts a on a.id = p.account_id and a.is_active
    left join organization_users o on o.id = p.owner_id
    where p.id = auth.uid()
      and p.is_active
      and p.club_id = current_club_id()
      and (p.owner_id is null or o.is_active)
      and (
        a.sessions_valid_after is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from a.sessions_valid_after))
      )
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_instructor(p_profile uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from club_profiles p
    join role_permissions rp on rp.role_id = p.org_role_id and rp.permission_code = 'classes.instruct'
    where p.id = p_profile and p.role = 'staff'
  );
$function$;
drop function log_audit(p_action text, p_target_type text, p_target_id uuid, p_details jsonb, p_tenant_id uuid, p_organization_id uuid, p_actor_id uuid, p_actor_role text, p_actor_label text);
CREATE FUNCTION public.log_audit(p_action text, p_target_type text DEFAULT NULL::text, p_target_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT '{}'::jsonb, p_club_id uuid DEFAULT NULL::uuid, p_organization_id uuid DEFAULT NULL::uuid, p_actor_id uuid DEFAULT NULL::uuid, p_actor_role text DEFAULT NULL::text, p_actor_label text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_club uuid := coalesce(p_club_id, current_club_id());
begin
  if coalesce(current_setting('club27.audit_suppress', true), '') = 'on' then
    return;
  end if;
  insert into audit_log (actor_id, actor_role, actor_label, club_id, organization_id, action, target_type, target_id, details)
  values (
    coalesce(p_actor_id, auth.uid()),
    coalesce(p_actor_role, nullif(auth.jwt() ->> 'app_role', '')),
    p_actor_label,
    v_club,
    coalesce(p_organization_id, (select organization_id from clubs where id = v_club)),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$function$;
revoke execute on function log_audit(p_action text, p_target_type text, p_target_id uuid, p_details jsonb, p_club_id uuid, p_organization_id uuid, p_actor_id uuid, p_actor_role text, p_actor_label text) from public, anon, authenticated;
grant execute on function log_audit(p_action text, p_target_type text, p_target_id uuid, p_details jsonb, p_club_id uuid, p_organization_id uuid, p_actor_id uuid, p_actor_role text, p_actor_label text) to service_role;
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
  if not exists (select 1 from club_members where id = p_member_id and club_id = current_club_id()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_point_id is not null and not exists (
    select 1 from checkin_points where id = p_point_id and club_id = current_club_id()
  ) then
    raise exception 'point not found';
  end if;
  return query select * from checkin_core(p_member_id, p_point_id, 'manual', auth.uid());
end;
$function$;
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_amount numeric(12, 2);
  v_club_id uuid;
begin
  if not (has_permission('invoices.collect')) then
    raise exception 'forbidden';
  end if;

  v_club_id := current_club_id();

  update invoices
  set status = 'paid', paid_at = now()
  where id = p_invoice_id and status = 'outstanding' and club_id = v_club_id
  returning amount into v_amount;

  if v_amount is null then
    raise exception 'invoice not found or already settled';
  end if;

  insert into cash_ledger (club_id, category, direction, amount, invoice_id, created_by)
  values (v_club_id, 'payment_received', 'in', v_amount, p_invoice_id, auth.uid());
end;
$function$;
drop function next_order_number(p_tenant uuid);
CREATE FUNCTION public.next_order_number(p_club uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Jakarta'))::int;
  v_value int;
begin
  insert into order_counters (club_id, year, last_value) values (p_club, v_year, 1)
  on conflict (club_id, year) do update set last_value = order_counters.last_value + 1
  returning last_value into v_value;
  return 'POS-' || v_year || '-' || lpad(v_value::text, 6, '0');
end;
$function$;
revoke execute on function next_order_number(p_club uuid) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.order_record_payment(p_order uuid, p_method text, p_amount numeric, p_reference text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o orders%rowtype;
  v_paid numeric;
  v_ledger uuid;
begin
  select * into o from orders where id = p_order;
  if p_method not in ('cash', 'transfer', 'qris', 'other') then
    raise exception using errcode = 'PS002', message = 'Metode pembayaran tidak valid';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = 'PS004', message = 'Jumlah pembayaran harus lebih dari 0';
  end if;
  select coalesce(sum(amount), 0) into v_paid from order_payments where order_id = p_order;
  if v_paid + p_amount > o.total then
    raise exception using errcode = 'PS004', message = 'Pembayaran melebihi sisa tagihan';
  end if;
  insert into cash_ledger (club_id, category, direction, amount, order_id, created_by)
  values (o.club_id, 'order_payment', 'in', p_amount, o.id, auth.uid())
  returning id into v_ledger;
  insert into order_payments (order_id, club_id, method, amount, reference, ledger_entry_id, created_by)
  values (o.id, o.club_id, p_method, p_amount, nullif(trim(coalesce(p_reference, '')), ''), v_ledger, auth.uid());
end;
$function$;
CREATE OR REPLACE FUNCTION public.organization_seats_used(p_org uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from organization_users where organization_id = p_org and is_active;
$function$;
CREATE OR REPLACE FUNCTION public.pause_subscriptions_on_member_deactivation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update member_memberships set status = 'paused' where member_id = new.id and status = 'active';
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.platform_quote(p_plan text, p_period text, p_users integer)
 RETURNS TABLE(users integer, unit_price numeric, months numeric, total numeric, per_month numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_price numeric;
  v_free numeric;
  v_users int := greatest(coalesce(p_users, 1), 1);
  v_months numeric;
  v_span numeric;
begin
  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'invalid billing period';
  end if;
  select price_per_seat_month, yearly_free_months into v_price, v_free
  from subscription_plans where code = p_plan;
  if v_price is null then
    raise exception 'plan not found';
  end if;
  v_months := case when p_period = 'yearly' then 12 - v_free else 1 end;
  v_span := case when p_period = 'yearly' then 12 else 1 end;
  return query select
    v_users,
    v_price,
    v_months,
    round(v_users * v_price * v_months, 2),
    round(v_users * v_price * v_months / v_span, 2);
end;
$function$;
CREATE OR REPLACE FUNCTION public.profile_permissions(p_profile uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select case
      when p.role = 'owner' and om.is_active and om.base_role in ('p_owner', 'owner')
        then (select array_agg(code) from permissions)
      when p.role = 'staff' and (
        not r.is_paid
        or exists (
          select 1
          from organization_users sm
          join organization_user_clubs c on c.member_id = sm.id and c.club_id = p.club_id
          where sm.account_id = p.account_id
            and sm.organization_id = t.organization_id
            and sm.is_active
            and sm.base_role in ('staff', 'owner', 'p_owner')
        )
      )
        then (select array_agg(rp.permission_code) from role_permissions rp where rp.role_id = p.org_role_id)
    end
    from club_profiles p
    join clubs t on t.id = p.club_id
    left join organization_users om on om.id = p.owner_id
    left join organization_roles r on r.id = p.org_role_id
    where p.id = p_profile and p.is_active
  ), '{}'::text[]);
$function$;
CREATE OR REPLACE FUNCTION public.protect_attended_class()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(current_setting('club27.purge', true), '') = 'on' then
    return old;
  end if;
  if exists (select 1 from class_bookings where class_id = old.id and is_attended) then
    raise exception using errcode = 'CL001', message = 'Kelas yang sudah punya catatan kehadiran tidak bisa dihapus';
  end if;
  return old;
end;
$function$;
CREATE OR REPLACE FUNCTION public.purge_organization(p_org uuid, p_execute boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
  v_reason text;
  v_clubs uuid[];
  v_steps constant text[] := array[
    'order_payments:t', 'order_items:t', 'cash_ledger:t', 'orders:t', 'payroll_runs:t', 'checkins:t', 'checkin_points:t',
    'resource_bookings:t', 'class_bookings:t', 'classes:t', 'class_types:t', 'resource_hours:t', 'resources:t',
    'coach_certifications:t', 'invoices:t', 'member_memberships:t', 'membership_packages:t', 'promos:t', 'products:t',
    'order_counters:t', 'club_module_overrides:t', 'consents:to', 'audit_log:to', 'club_members:t',
    'organization_user_clubs:t', 'invitations:o', 'club_profiles:t', 'locations:t',
    'clubs:o', 'subscription_reminders:o', 'subscription_renewals:o', 'email_verifications:o',
    'organization_roles:o', 'organization_subscriptions:o', 'organization_users:o', 'organizations:id'
  ];
  v_step text;
  v_table text;
  v_scope text;
  v_cond text;
  v_count bigint;
  v_counts jsonb := '{}'::jsonb;
  r record;
begin
  select name into v_name from organizations where id = p_org;
  if v_name is null then
    raise exception using errcode = 'PG001', message = 'Organisasi tidak ditemukan';
  end if;
  if p_execute then
    if not coalesce((select enabled from platform_flags where key = 'purge_enabled'), false) then
      raise exception using errcode = 'PG002', message = 'Purge dimatikan';
    end if;
    select c.reason into v_reason from purge_candidates() c where c.organization_id = p_org;
    if v_reason is null then
      raise exception using errcode = 'PG001', message = 'Organisasi belum memenuhi syarat purge';
    end if;
  end if;

  v_clubs := array(select id from clubs where organization_id = p_org);

  if p_execute then
    perform set_config('club27.purge', 'on', true);
    update payroll_runs set cash_ledger_entry_id = null where club_id = any(v_clubs);
  end if;

  foreach v_step in array v_steps loop
    v_table := split_part(v_step, ':', 1);
    v_scope := split_part(v_step, ':', 2);
    v_cond := case v_scope
      when 't' then 'club_id = any($1)'
      when 'to' then 'club_id = any($1) or organization_id = $2'
      when 'o' then 'organization_id = $2'
      else 'id = $2'
    end;
    if p_execute then
      execute format('delete from %I where %s', v_table, v_cond) using v_clubs, p_org;
      get diagnostics v_count = row_count;
    else
      execute format('select count(*) from %I where %s', v_table, v_cond) into v_count using v_clubs, p_org;
    end if;
    v_counts := v_counts || jsonb_build_object(v_table, v_count);
  end loop;

  if p_execute then
    for r in
      select c.relname
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'club_id' and not a.attisdropped
      where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
    loop
      execute format('select count(*) from %I where club_id = any($1)', r.relname) into v_count using v_clubs;
      if v_count > 0 then
        raise exception using errcode = 'PG003', message = format('Data sisa di %s setelah purge', r.relname);
      end if;
    end loop;
    for r in
      select c.relname
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
      where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace and c.relname <> 'organization_purges'
    loop
      execute format('select count(*) from %I where organization_id = $1', r.relname) into v_count using p_org;
      if v_count > 0 then
        raise exception using errcode = 'PG003', message = format('Data sisa di %s setelah purge', r.relname);
      end if;
    end loop;
    insert into organization_purges (organization_id, organization_name, reason, counts)
    values (p_org, v_name, v_reason, v_counts);
  end if;

  return jsonb_build_object('dry_run', not p_execute, 'organization', v_name, 'counts', v_counts);
end;
$function$;
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
  where id = p_point_id and club_id = current_club_id() and is_active;
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
$function$;
drop function register_organization(p_organization_name text, p_tenant_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text);
CREATE FUNCTION public.register_organization(p_organization_name text, p_club_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text DEFAULT 'swimming'::text)
 RETURNS TABLE(organization_id uuid, club_id uuid, owner_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_account accounts%rowtype;
  v_org uuid;
  v_club uuid;
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

  insert into organization_users (organization_id, account_id, email, full_name, base_role)
  values (v_org, v_account.id, v_account.email, v_account.full_name, 'p_owner') returning id into v_owner;

  v_club := create_club_row(v_org, p_club_name, p_club_type);

  insert into club_profiles (club_id, role, full_name, email, owner_id, account_id)
  values (v_club, 'owner', v_account.full_name, v_account.email, v_owner, v_account.id) returning id into v_profile;

  return query select v_org, v_club, v_owner, v_profile;
end;
$function$;
revoke execute on function register_organization(p_organization_name text, p_club_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text) from public, anon, authenticated;
grant execute on function register_organization(p_organization_name text, p_club_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text) to service_role;
drop function register_organization_unverified(p_organization_name text, p_tenant_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text, p_token_hash text);
CREATE FUNCTION public.register_organization_unverified(p_organization_name text, p_club_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text, p_token_hash text)
 RETURNS TABLE(organization_id uuid, club_id uuid, owner_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
begin
  select * into r from register_organization(
    p_organization_name, p_club_name, p_account_id, p_plan, p_period, p_club_type
  );
  update organization_subscriptions set status = 'pending_verification', trial_ends_at = null
  where organization_subscriptions.organization_id = r.organization_id;
  insert into email_verifications (organization_id, owner_id, token_hash, expires_at)
  values (r.organization_id, r.owner_id, p_token_hash, now() + interval '24 hours');
  return query select r.organization_id, r.club_id, r.owner_id, r.profile_id;
end;
$function$;
revoke execute on function register_organization_unverified(p_organization_name text, p_club_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text, p_token_hash text) from public, anon, authenticated;
grant execute on function register_organization_unverified(p_organization_name text, p_club_name text, p_account_id uuid, p_plan text, p_period text, p_club_type text, p_token_hash text) to service_role;
CREATE OR REPLACE FUNCTION public.request_organization_deletion(p_org uuid, p_actor_account uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_account uuid;
  v_prev text;
  v_after timestamptz;
begin
  select account_id into v_owner_account
  from organization_users where organization_id = p_org and base_role = 'p_owner' and is_active for update;
  if v_owner_account is null or v_owner_account is distinct from p_actor_account then
    raise exception using errcode = 'OW001', message = 'Hanya pemilik utama yang dapat menghapus organisasi';
  end if;
  if exists (select 1 from organizations where id = p_org and deletion_requested_at is not null) then
    raise exception using errcode = 'DL001', message = 'Penghapusan organisasi sudah diminta';
  end if;
  select status into v_prev from organization_subscriptions where organization_id = p_org for update;
  if v_prev is null or v_prev = 'pending_verification' then
    raise exception using errcode = '22023', message = 'Organisasi belum diverifikasi';
  end if;
  v_after := now() + interval '30 days';
  update organizations set
    deletion_requested_at = now(),
    deletion_requested_by = p_actor_account,
    purge_after = v_after,
    deletion_previous_status = v_prev
  where id = p_org;
  perform set_organization_status(p_org, 'cancelled', 'penghapusan oleh pemilik');
  update invitations set status = 'revoked' where organization_id = p_org and status = 'pending';
  return v_after;
end;
$function$;
CREATE OR REPLACE FUNCTION public.request_renewal(p_org uuid, p_owner uuid, p_plan text, p_period text, p_seats integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_limit int;
  v_clubs int;
  v_seats int;
  v_used int;
  v_mid boolean;
  s organization_subscriptions%rowtype;
  q record;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not exists (select 1 from subscription_plans where code = p_plan and is_active) then
    raise exception using errcode = '22023', message = 'Paket tidak tersedia';
  end if;
  select * into s from organization_subscriptions where organization_id = p_org for update;
  if s.organization_id is null then
    raise exception 'subscription not found';
  end if;

  select coalesce(s.club_limit_override, sp.club_limit) into v_limit from subscription_plans sp where sp.code = p_plan;
  select count(*) into v_clubs from clubs where organization_id = p_org;
  if v_limit is not null and v_clubs > v_limit then
    raise exception using errcode = 'SW004',
      message = format('Paket ini hanya untuk %s klub, sedangkan organisasi Anda punya %s klub.', v_limit, v_clubs);
  end if;

  v_mid := s.status = 'active' and s.current_period_end is not null and s.current_period_end >= v_today;
  v_seats := coalesce(p_seats, s.pending_seats, s.seats);
  v_used := organization_seats_used(p_org);
  if v_seats < 1 or v_seats > 1000 then
    raise exception using errcode = '22023', message = 'Jumlah seat tidak valid';
  end if;
  if v_seats < v_used then
    raise exception using errcode = '22023',
      message = format('Jumlah seat tidak boleh kurang dari pengguna aktif (%s). Nonaktifkan pengguna lebih dulu.', v_used);
  end if;
  if v_mid and v_seats > s.seats then
    raise exception using errcode = '22023',
      message = 'Menambah seat saat langganan berjalan dilakukan lewat pembelian seat.';
  end if;

  select * into q from platform_quote(p_plan, p_period, v_seats);

  update subscription_renewals set status = 'cancelled' where organization_id = p_org and status = 'pending';
  insert into subscription_renewals (organization_id, plan_code, billing_period, users, unit_price, months, amount, requested_by)
  values (p_org, p_plan, p_period, q.users, q.unit_price, q.months, q.total, p_owner)
  returning id into v_id;
  return v_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.resource_availability(p_resource_id uuid, p_date date)
 RETURNS TABLE(slot_start timestamp with time zone, slot_end timestamp with time zone, remaining integer, bookable boolean, mine boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r resources%rowtype;
  hrs resource_hours%rowtype;
  v_member uuid := case when is_member() then current_member_id() end;
  v_is_member boolean := is_member();
begin
  if not is_active_user() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_club_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  select * into r from resources where id = p_resource_id and club_id = current_club_id() and is_active;
  if r.id is null then
    return;
  end if;
  select * into hrs from resource_hours where resource_id = r.id and weekday = extract(dow from p_date)::int;
  if hrs.resource_id is null then
    return;
  end if;

  return query
  with slots as (
    select
      ((p_date + hrs.opens) + make_interval(mins => k * r.slot_minutes)) at time zone 'Asia/Jakarta' as s,
      ((p_date + hrs.opens) + make_interval(mins => (k + 1) * r.slot_minutes)) at time zone 'Asia/Jakarta' as e,
      (extract(epoch from hrs.opens) / 60 + (k + 1) * r.slot_minutes) as end_min
    from generate_series(0, 1440 / r.slot_minutes) k
  )
  select
    sl.s,
    sl.e,
    greatest(r.capacity - resource_max_overlap(r.id, sl.s, sl.e, null), 0),
    greatest(r.capacity - resource_max_overlap(r.id, sl.s, sl.e, null), 0) > 0
      and case
        when v_is_member then sl.s > now() and sl.s <= now() + make_interval(days => r.advance_days)
          and not exists (
            select 1 from resource_bookings b
            where b.resource_id = r.id and b.member_id = v_member and b.status = 'confirmed'
              and b.start_time < sl.e and b.end_time > sl.s
          )
        else sl.e > now()
      end,
    v_member is not null and exists (
      select 1 from resource_bookings b
      where b.resource_id = r.id and b.member_id = v_member and b.status = 'confirmed'
        and b.start_time < sl.e and b.end_time > sl.s
    )
  from slots sl
  where sl.end_min <= extract(epoch from hrs.closes) / 60
  order by sl.s;
end;
$function$;
CREATE OR REPLACE FUNCTION public.resource_booking_insert(p_resource_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_member_id uuid, p_guest_name text, p_guest_phone text, p_source text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r resources%rowtype;
  v_slots numeric;
  v_id uuid;
begin
  select * into r from resources where id = p_resource_id and club_id = current_club_id() and is_active;
  if r.id is null then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  if p_end <= p_start then
    raise exception using errcode = 'RB002', message = 'Waktu selesai harus setelah waktu mulai';
  end if;
  v_slots := extract(epoch from (p_end - p_start)) / 60 / r.slot_minutes;
  insert into resource_bookings (club_id, resource_id, member_id, guest_name, guest_phone, start_time, end_time, price, source, created_by)
  values (
    current_club_id(), r.id, p_member_id, nullif(trim(p_guest_name), ''), nullif(trim(p_guest_phone), ''),
    p_start, p_end, round(r.price_per_slot * v_slots, 2), p_source, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.search_similar_members(p_full_name text, p_date_of_birth date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, full_name text, date_of_birth date, contact_name text, similarity real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    m.id,
    m.full_name,
    m.date_of_birth,
    m.contact_name,
    greatest(
      similarity(m.full_name, p_full_name),
      case when p_date_of_birth is not null and m.date_of_birth = p_date_of_birth then 1 else 0 end
    ) as similarity
  from club_members m
  where m.is_active
    and m.club_id = current_club_id()
    and (
      similarity(m.full_name, p_full_name) > 0.3
      or (p_date_of_birth is not null and m.date_of_birth = p_date_of_birth)
    )
  order by similarity desc
  limit 5;
$function$;
CREATE OR REPLACE FUNCTION public.seat_quote(p_org uuid, p_add integer)
 RETURNS TABLE(seats_before integer, seats_after integer, unit_price numeric, remaining_days integer, period_days integer, amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s organization_subscriptions%rowtype;
  v_price numeric;
  v_free numeric;
  v_factor numeric;
  v_unit numeric;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_start date;
  v_period int;
  v_remaining int;
begin
  if p_add is null or p_add < 1 or p_add > 1000 then
    raise exception using errcode = '22023', message = 'Jumlah seat tidak valid';
  end if;
  select * into s from organization_subscriptions where organization_id = p_org;
  if s.organization_id is null then
    raise exception 'subscription not found';
  end if;
  if s.status <> 'active' or s.current_period_end is null or s.current_period_end < v_today then
    raise exception using errcode = '22023',
      message = 'Seat tambahan hanya bisa dibeli saat langganan aktif. Perpanjang langganan lebih dulu.';
  end if;
  select price_per_seat_month, yearly_free_months into v_price, v_free from subscription_plans where code = s.plan_code;
  v_factor := case when s.billing_period = 'yearly' then 12 - v_free else 1 end;
  v_unit := v_price * v_factor;
  v_start := coalesce(s.current_period_start, s.current_period_end - case when s.billing_period = 'yearly' then 364 else 30 end);
  v_period := greatest(s.current_period_end - v_start + 1, 1);
  v_remaining := s.current_period_end - v_today + 1;
  return query select
    s.seats,
    s.seats + p_add,
    v_unit,
    v_remaining,
    v_period,
    round(p_add * v_unit * v_remaining / v_period, 0);
end;
$function$;
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
  if not club_has_module(current_club_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  if p_status not in ('completed', 'no_show') then
    raise exception using errcode = 'RB008', message = 'Status tidak valid';
  end if;
  select * into b from resource_bookings where id = p_booking_id and club_id = current_club_id() for update;
  if b.id is null or b.class_id is not null or b.status <> 'confirmed' then
    raise exception using errcode = 'RB008', message = 'Booking tidak dapat diubah';
  end if;
  if b.start_time > now() then
    raise exception using errcode = 'RB008', message = 'Booking belum dimulai';
  end if;
  update resource_bookings set status = p_status where id = b.id;
end;
$function$;
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
  insert into club_module_overrides (club_id, module_code, enabled, changed_by)
  values (current_club_id(), p_module, p_enabled, auth.uid())
  on conflict (club_id, module_code) do update
    set enabled = excluded.enabled, changed_by = excluded.changed_by, changed_at = now();
end;
$function$;
CREATE OR REPLACE FUNCTION public.set_organization_status(p_organization_id uuid, p_status text, p_actor text DEFAULT NULL::text, p_period_start date DEFAULT NULL::date, p_period_end date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_period text;
  v_previous text;
  v_end date;
begin
  if p_status not in ('pending', 'trial', 'active', 'expired', 'suspended', 'cancelled') then
    raise exception 'invalid status';
  end if;

  select billing_period, status into v_period, v_previous
  from organization_subscriptions where organization_id = p_organization_id for update;
  if v_period is null then
    raise exception 'subscription not found';
  end if;

  v_end := coalesce(
    p_period_end,
    case when p_period_start is not null then p_period_start + case when v_period = 'yearly' then interval '1 year' else interval '1 month' end end
  );

  update organization_subscriptions set
    status = p_status,
    current_period_start = case when p_status = 'active' and p_period_start is not null then p_period_start else current_period_start end,
    current_period_end = case when p_status = 'active' and v_end is not null then v_end else current_period_end end,
    activated_at = case when p_status = 'active' and (v_previous <> 'active' or p_period_start is not null) then now() else activated_at end,
    activated_by = case when p_status = 'active' and (v_previous <> 'active' or p_period_start is not null) then p_actor else activated_by end
  where organization_id = p_organization_id;

  update clubs set is_active = (p_status in ('pending', 'trial', 'active', 'expired'))
  where organization_id = p_organization_id;
end;
$function$;
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
  if not exists (select 1 from resources where id = p_resource_id and club_id = current_club_id()) then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  delete from resource_hours where resource_id = p_resource_id;
  insert into resource_hours (resource_id, club_id, weekday, opens, closes)
  select p_resource_id, current_club_id(), (h ->> 'weekday')::int, (h ->> 'opens')::time, (h ->> 'closes')::time
  from jsonb_array_elements(p_hours) h;
end;
$function$;
CREATE OR REPLACE FUNCTION public.stamp_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
    new.accepted_at := now();
  end if;
  if new.club_id is not null then
    new.organization_id := (select organization_id from clubs where id = new.club_id);
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.sync_class_resource_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r resources%rowtype;
begin
  if new.resource_id is null then
    delete from resource_bookings where class_id = new.id;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.resource_id is not distinct from new.resource_id
     and not club_has_module(new.club_id, 'resource_booking') then
    return new;
  end if;

  select * into r from resources where id = new.resource_id;
  if r.id is null or r.club_id <> new.club_id or r.location_id <> new.location_id then
    raise exception using errcode = 'RB008', message = 'Fasilitas harus berada di lokasi kelas yang sama';
  end if;
  if not club_has_module(new.club_id, 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;

  update resource_bookings
  set resource_id = new.resource_id, start_time = new.start_time, end_time = new.end_time, status = 'confirmed'
  where class_id = new.id;
  if not found then
    insert into resource_bookings (club_id, resource_id, class_id, start_time, end_time, status, price, source)
    values (new.club_id, new.resource_id, new.id, new.start_time, new.end_time, 'confirmed', 0, 'class');
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.transfer_ownership(p_org uuid, p_to_member uuid, p_actor_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_from uuid;
  v_from_account uuid;
begin
  select id, account_id into v_from, v_from_account
  from organization_users where organization_id = p_org and base_role = 'p_owner' and is_active for update;
  if v_from is null or v_from_account is distinct from p_actor_account then
    raise exception using errcode = 'OW001', message = 'Hanya pemilik utama yang dapat memindahkan kepemilikan';
  end if;
  if not exists (
    select 1 from organization_users where id = p_to_member and organization_id = p_org and base_role = 'owner' and is_active
  ) then
    raise exception using errcode = 'OW002', message = 'Penerima harus pemilik aktif organisasi ini';
  end if;
  update organization_users set base_role = 'owner' where id = v_from;
  update organization_users set base_role = 'p_owner' where id = p_to_member;
end;
$function$;
drop function verify_registration(p_token_hash text);
CREATE FUNCTION public.verify_registration(p_token_hash text)
 RETURNS TABLE(organization_id uuid, club_id uuid, profile_id uuid, account_id uuid, email text, full_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v record;
  v_trial_days int;
begin
  select ev.* into v from email_verifications ev
  where ev.token_hash = p_token_hash and ev.used_at is null and ev.expires_at > now()
  for update;
  if v.id is null then
    return;
  end if;
  update email_verifications set used_at = now() where id = v.id;

  select sp.trial_days into v_trial_days
  from organization_subscriptions os join subscription_plans sp on sp.code = os.plan_code
  where os.organization_id = v.organization_id;

  update organization_subscriptions set
    status = case when coalesce(v_trial_days, 0) > 0 then 'trial' else 'pending' end,
    trial_ends_at = case when coalesce(v_trial_days, 0) > 0 then (now() at time zone 'Asia/Jakarta')::date + v_trial_days end
  where organization_subscriptions.organization_id = v.organization_id and status = 'pending_verification';

  update accounts set email_verified_at = now()
  where id = (select o.account_id from organization_users o where o.id = v.owner_id) and email_verified_at is null;

  return query
  select t.organization_id, p.club_id, p.id, p.account_id, p.email, p.full_name
  from club_profiles p join clubs t on t.id = p.club_id
  where p.owner_id = v.owner_id
  order by t.created_at
  limit 1;
end;
$function$;
revoke execute on function verify_registration(p_token_hash text) from public, anon, authenticated;
grant execute on function verify_registration(p_token_hash text) to service_role;
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
  where id = p_invoice_id and club_id = current_club_id() and status = 'outstanding';
  if not found then
    raise exception using errcode = 'IV001', message = 'Tagihan tidak ditemukan atau sudah lunas';
  end if;
end;
$function$;
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
  if not club_has_module(current_club_id(), 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  if length(v_reason) < 5 then
    raise exception using errcode = 'PS007', message = 'Tulis alasan pembatalan, minimal 5 karakter';
  end if;
  select * into o from orders where id = p_order_id and club_id = current_club_id() for update;
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

    insert into cash_ledger (club_id, category, direction, amount, order_id, reason, created_by)
    select o.club_id, 'order_reversal', 'out', amount, o.id, 'Pembatalan pesanan ' || o.number || ': ' || v_reason, auth.uid()
    from order_payments where order_id = o.id;

    update resource_bookings set paid_at = null
    where id in (select booking_id from order_items where order_id = o.id and booking_id is not null);
  end if;

  update orders set status = 'void', voided_at = now(), void_reason = v_reason, voided_by = auth.uid() where id = o.id;
end;
$function$;

-- constraints, indexes, triggers and policies
alter table audit_log rename constraint audit_log_tenant_id_fkey to audit_log_club_id_fkey;
alter table class_bookings rename constraint bookings_class_id_fkey to class_bookings_class_id_fkey;
alter table class_bookings rename constraint bookings_member_id_class_id_key to class_bookings_member_id_class_id_key;
alter table class_bookings rename constraint bookings_member_id_fkey to class_bookings_member_id_fkey;
alter table class_bookings rename constraint bookings_notes_length to class_bookings_notes_length;
alter table class_bookings rename constraint bookings_pkey to class_bookings_pkey;
alter table class_bookings rename constraint bookings_tenant_id_fkey to class_bookings_club_id_fkey;
alter table cash_ledger rename constraint cash_ledger_tenant_id_fkey to cash_ledger_club_id_fkey;
alter table checkin_points rename constraint checkin_points_tenant_id_fkey to checkin_points_club_id_fkey;
alter table checkin_points rename constraint checkin_points_tenant_id_name_key to checkin_points_club_id_name_key;
alter table checkins rename constraint checkins_tenant_id_fkey to checkins_club_id_fkey;
alter table class_types rename constraint class_types_tenant_id_fkey to class_types_club_id_fkey;
alter table class_types rename constraint class_types_tenant_id_name_key to class_types_club_id_name_key;
alter table classes rename constraint classes_tenant_id_fkey to classes_club_id_fkey;
alter table coach_certifications rename constraint coach_certifications_tenant_id_fkey to coach_certifications_club_id_fkey;
alter table consents rename constraint consents_tenant_id_fkey to consents_club_id_fkey;
alter table invitations rename constraint invitations_tenant_id_fkey to invitations_club_id_fkey;
alter table invoices rename constraint invoices_tenant_id_fkey to invoices_club_id_fkey;
alter table locations rename constraint locations_tenant_id_fkey to locations_club_id_fkey;
alter table locations rename constraint locations_tenant_id_name_key to locations_club_id_name_key;
alter table club_members rename constraint members_address_length to club_members_address_length;
alter table club_members rename constraint members_coach_id_fkey to club_members_coach_id_fkey;
alter table club_members rename constraint members_contact_name_length to club_members_contact_name_length;
alter table club_members rename constraint members_date_of_birth_range to club_members_date_of_birth_range;
alter table club_members rename constraint members_full_name_length to club_members_full_name_length;
alter table club_members rename constraint members_notes_length to club_members_notes_length;
alter table club_members rename constraint members_pkey to club_members_pkey;
alter table club_members rename constraint members_preferred_location_id_fkey to club_members_preferred_location_id_fkey;
alter table club_members rename constraint members_profile_id_fkey to club_members_profile_id_fkey;
alter table club_members rename constraint members_profile_id_key to club_members_profile_id_key;
alter table club_members rename constraint members_tenant_id_fkey to club_members_club_id_fkey;
alter table membership_packages rename constraint membership_packages_tenant_id_fkey to membership_packages_club_id_fkey;
alter table order_counters rename constraint order_counters_tenant_id_fkey to order_counters_club_id_fkey;
alter table order_items rename constraint order_items_tenant_id_fkey to order_items_club_id_fkey;
alter table order_payments rename constraint order_payments_tenant_id_fkey to order_payments_club_id_fkey;
alter table orders rename constraint orders_tenant_id_fkey to orders_club_id_fkey;
alter table orders rename constraint orders_tenant_id_number_key to orders_club_id_number_key;
alter table organization_user_clubs rename constraint organization_member_clubs_member_id_fkey to organization_user_clubs_member_id_fkey;
alter table organization_user_clubs rename constraint organization_member_clubs_pkey to organization_user_clubs_pkey;
alter table organization_user_clubs rename constraint organization_member_clubs_tenant_id_fkey to organization_user_clubs_club_id_fkey;
alter table organization_users rename constraint organization_members_base_role_check to organization_users_base_role_check;
alter table organization_users rename constraint organization_members_one_p_owner to organization_users_one_p_owner;
alter table payroll_runs rename constraint payroll_runs_tenant_id_fkey to payroll_runs_club_id_fkey;
alter table products rename constraint products_tenant_id_fkey to products_club_id_fkey;
alter table club_profiles rename constraint profiles_account_id_fkey to club_profiles_account_id_fkey;
alter table club_profiles rename constraint profiles_email_lowercase to club_profiles_email_lowercase;
alter table club_profiles rename constraint profiles_full_name_length to club_profiles_full_name_length;
alter table club_profiles rename constraint profiles_member_has_account to club_profiles_member_has_account;
alter table club_profiles rename constraint profiles_member_link to club_profiles_member_link;
alter table club_profiles rename constraint profiles_org_role_id_fkey to club_profiles_org_role_id_fkey;
alter table club_profiles rename constraint profiles_owner_id_fkey to club_profiles_owner_id_fkey;
alter table club_profiles rename constraint profiles_owner_role to club_profiles_owner_role;
alter table club_profiles rename constraint profiles_pkey to club_profiles_pkey;
alter table club_profiles rename constraint profiles_role_check to club_profiles_role_check;
alter table club_profiles rename constraint profiles_session_rate_check to club_profiles_session_rate_check;
alter table club_profiles rename constraint profiles_staff_role to club_profiles_staff_role;
alter table club_profiles rename constraint profiles_tenant_id_email_key to club_profiles_club_id_email_key;
alter table club_profiles rename constraint profiles_tenant_id_fkey to club_profiles_club_id_fkey;
alter table promos rename constraint promo_active_range to promos_active_range;
alter table promos rename constraint promo_author_id_fkey to promos_author_id_fkey;
alter table promos rename constraint promo_body_length to promos_body_length;
alter table promos rename constraint promo_pkey to promos_pkey;
alter table promos rename constraint promo_tenant_id_fkey to promos_club_id_fkey;
alter table promos rename constraint promo_title_length to promos_title_length;
alter table resource_bookings rename constraint resource_bookings_tenant_id_fkey to resource_bookings_club_id_fkey;
alter table resource_hours rename constraint resource_hours_tenant_id_fkey to resource_hours_club_id_fkey;
alter table resources rename constraint resources_tenant_id_fkey to resources_club_id_fkey;
alter table member_memberships rename constraint subscriptions_member_id_fkey to member_memberships_member_id_fkey;
alter table member_memberships rename constraint subscriptions_package_id_fkey to member_memberships_package_id_fkey;
alter table member_memberships rename constraint subscriptions_pkey to member_memberships_pkey;
alter table member_memberships rename constraint subscriptions_status_check to member_memberships_status_check;
alter table member_memberships rename constraint subscriptions_tenant_id_fkey to member_memberships_club_id_fkey;
alter table club_module_overrides rename constraint tenant_module_overrides_changed_by_fkey to club_module_overrides_changed_by_fkey;
alter table club_module_overrides rename constraint tenant_module_overrides_module_code_check to club_module_overrides_module_code_check;
alter table club_module_overrides rename constraint tenant_module_overrides_module_code_fkey to club_module_overrides_module_code_fkey;
alter table club_module_overrides rename constraint tenant_module_overrides_pkey to club_module_overrides_pkey;
alter table club_module_overrides rename constraint tenant_module_overrides_tenant_id_fkey to club_module_overrides_club_id_fkey;
alter table clubs rename constraint tenants_club_type_fkey to clubs_club_type_fkey;
alter table clubs rename constraint tenants_name_length to clubs_name_length;
alter table clubs rename constraint tenants_organization_id_fkey to clubs_organization_id_fkey;
alter table clubs rename constraint tenants_pkey to clubs_pkey;
alter table clubs rename constraint tenants_slug_key to clubs_slug_key;
alter index audit_log_tenant_at_idx rename to audit_log_club_at_idx;
alter index bookings_class_id_idx rename to class_bookings_class_id_idx;
alter index bookings_member_id_idx rename to class_bookings_member_id_idx;
alter index bookings_tenant_id_idx rename to class_bookings_club_id_idx;
alter index cash_ledger_tenant_id_idx rename to cash_ledger_club_id_idx;
alter index checkin_points_tenant_id_idx rename to checkin_points_club_id_idx;
alter index checkins_tenant_time_idx rename to checkins_club_time_idx;
alter index class_types_tenant_id_idx rename to class_types_club_id_idx;
alter index classes_tenant_id_idx rename to classes_club_id_idx;
alter index coach_certifications_tenant_id_idx rename to coach_certifications_club_id_idx;
alter index consents_tenant_idx rename to consents_club_idx;
alter index invoices_tenant_due_idx rename to invoices_club_due_idx;
alter index invoices_tenant_id_idx rename to invoices_club_id_idx;
alter index locations_tenant_id_idx rename to locations_club_id_idx;
alter index members_coach_id_idx rename to club_members_coach_id_idx;
alter index members_full_name_trgm_idx rename to club_members_full_name_trgm_idx;
alter index members_preferred_location_idx rename to club_members_preferred_location_idx;
alter index members_tenant_id_idx rename to club_members_club_id_idx;
alter index members_tenant_name_idx rename to club_members_club_name_idx;
alter index membership_packages_tenant_id_idx rename to membership_packages_club_id_idx;
alter index order_items_tenant_idx rename to order_items_club_idx;
alter index order_payments_tenant_idx rename to order_payments_club_idx;
alter index orders_tenant_created_idx rename to orders_club_created_idx;
alter index organization_member_clubs_tenant_idx rename to organization_user_clubs_club_idx;
alter index organization_members_email_idx rename to organization_users_email_idx;
alter index organization_members_one_p_owner_idx rename to organization_users_one_p_owner_idx;
alter index organization_members_org_account_idx rename to organization_users_org_account_idx;
alter index payroll_runs_tenant_id_idx rename to payroll_runs_club_id_idx;
alter index products_tenant_id_idx rename to products_club_id_idx;
alter index profiles_account_idx rename to club_profiles_account_idx;
alter index profiles_account_tenant_idx rename to club_profiles_account_club_idx;
alter index profiles_org_role_idx rename to club_profiles_org_role_idx;
alter index profiles_owner_tenant_idx rename to club_profiles_owner_club_idx;
alter index profiles_tenant_id_idx rename to club_profiles_club_id_idx;
alter index promo_author_idx rename to promos_author_idx;
alter index promo_tenant_id_idx rename to promos_club_id_idx;
alter index resource_bookings_tenant_time_idx rename to resource_bookings_club_time_idx;
alter index resource_hours_tenant_idx rename to resource_hours_club_idx;
alter index resources_tenant_id_idx rename to resources_club_id_idx;
alter index subscriptions_member_id_idx rename to member_memberships_member_id_idx;
alter index subscriptions_one_active_per_member_idx rename to member_memberships_one_active_per_member_idx;
alter index subscriptions_package_idx rename to member_memberships_package_idx;
alter index subscriptions_tenant_id_idx rename to member_memberships_club_id_idx;
alter index subscriptions_tenant_start_idx rename to member_memberships_club_start_idx;
alter index tenant_module_overrides_changed_by_idx rename to club_module_overrides_changed_by_idx;
alter index tenant_module_overrides_module_idx rename to club_module_overrides_module_idx;
alter index tenants_club_type_idx rename to clubs_club_type_idx;
alter index tenants_organization_id_idx rename to clubs_organization_id_idx;
alter trigger bookings_enforce_billing on class_bookings rename to class_bookings_enforce_billing;
alter trigger bookings_enforce_capacity on class_bookings rename to class_bookings_enforce_capacity;
alter trigger bookings_enforce_rules on class_bookings rename to class_bookings_enforce_rules;
alter trigger cash_ledger_enforce_tenant on cash_ledger rename to cash_ledger_enforce_club;
alter trigger cash_ledger_tenant_refs on cash_ledger rename to cash_ledger_club_refs;
alter trigger checkins_tenant_refs on checkins rename to checkins_club_refs;
alter trigger invoices_enforce_tenant on invoices rename to invoices_enforce_club;
alter trigger members_audit_status on club_members rename to club_members_audit_status;
alter trigger members_enforce_billing on club_members rename to club_members_enforce_billing;
alter trigger members_enforce_coach_update on club_members rename to club_members_enforce_coach_update;
alter trigger members_enforce_profile_link on club_members rename to club_members_enforce_profile_link;
alter trigger members_enforce_refs on club_members rename to club_members_enforce_refs;
alter trigger members_pause_subscriptions on club_members rename to club_members_pause_subscriptions;
alter trigger members_set_updated_at on club_members rename to club_members_set_updated_at;
alter trigger order_payments_tenant_refs on order_payments rename to order_payments_club_refs;
alter trigger orders_tenant_refs on orders rename to orders_club_refs;
alter trigger organization_member_clubs_enforce on organization_user_clubs rename to organization_user_clubs_enforce;
alter trigger organization_members_enforce_billing on organization_users rename to organization_users_enforce_billing;
alter trigger organization_members_enforce_email on organization_users rename to organization_users_enforce_email;
alter trigger organization_members_enforce_seats on organization_users rename to organization_users_enforce_seats;
alter trigger organization_members_identity_account on organization_users rename to organization_users_identity_account;
alter trigger organization_members_one_p_owner on organization_users rename to organization_users_one_p_owner;
alter trigger organization_members_set_updated_at on organization_users rename to organization_users_set_updated_at;
alter trigger payroll_runs_tenant_refs on payroll_runs rename to payroll_runs_club_refs;
alter trigger profiles_audit on club_profiles rename to club_profiles_audit;
alter trigger profiles_enforce_account_link on club_profiles rename to club_profiles_enforce_account_link;
alter trigger profiles_enforce_billing on club_profiles rename to club_profiles_enforce_billing;
alter trigger profiles_enforce_identity on club_profiles rename to club_profiles_enforce_identity;
alter trigger profiles_enforce_role_link on club_profiles rename to club_profiles_enforce_role_link;
alter trigger profiles_enforce_self_update on club_profiles rename to club_profiles_enforce_self_update;
alter trigger profiles_identity_account on club_profiles rename to club_profiles_identity_account;
alter trigger profiles_member_link on club_profiles rename to club_profiles_member_link;
alter trigger profiles_set_updated_at on club_profiles rename to club_profiles_set_updated_at;
alter trigger promo_set_updated_at on promos rename to promos_set_updated_at;
alter trigger promo_tenant_refs on promos rename to promos_club_refs;
alter trigger resource_bookings_tenant_refs on resource_bookings rename to resource_bookings_club_refs;
alter trigger subscriptions_create_session_pack_invoice on member_memberships rename to member_memberships_create_session_pack_invoice;
alter trigger subscriptions_enforce_tenant on member_memberships rename to member_memberships_enforce_club;
alter trigger subscriptions_set_session_pack_end_date on member_memberships rename to member_memberships_set_session_pack_end_date;
alter trigger subscriptions_set_updated_at on member_memberships rename to member_memberships_set_updated_at;
alter trigger tenant_module_overrides_tenant_refs on club_module_overrides rename to club_module_overrides_club_refs;
alter trigger tenants_enforce_org_max on clubs rename to clubs_enforce_org_max;
alter trigger tenants_set_updated_at on clubs rename to clubs_set_updated_at;
alter policy "bookings_delete" on class_bookings rename to "class_bookings_delete";
alter policy "bookings_insert" on class_bookings rename to "class_bookings_insert";
alter policy "bookings_select" on class_bookings rename to "class_bookings_select";
alter policy "bookings_update" on class_bookings rename to "class_bookings_update";
alter policy "members_delete" on club_members rename to "club_members_delete";
alter policy "members_insert" on club_members rename to "club_members_insert";
alter policy "members_select" on club_members rename to "club_members_select";
alter policy "members_update" on club_members rename to "club_members_update";
alter policy "profiles_select" on club_profiles rename to "club_profiles_select";
alter policy "profiles_update" on club_profiles rename to "club_profiles_update";
alter policy "promo_select" on promos rename to "promos_select";
alter policy "promo_write_admin" on promos rename to "promos_write_admin";
alter policy "subscriptions_select" on member_memberships rename to "member_memberships_select";
alter policy "subscriptions_write" on member_memberships rename to "member_memberships_write";
alter policy "tenant_module_overrides_select_admin" on club_module_overrides rename to "club_module_overrides_select_admin";
alter policy "tenants_select_own" on clubs rename to "clubs_select_own";
alter policy "tenants_update_admin" on clubs rename to "clubs_update_admin";

