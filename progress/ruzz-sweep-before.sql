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
$function$

;

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
  select id into v_id from orders where client_request_id = p_request_id and club_id = current_club_id();
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
$function$

;

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
$function$

;

CREATE OR REPLACE FUNCTION public.log_audit(p_action text, p_target_type text DEFAULT NULL::text, p_target_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT '{}'::jsonb, p_club_id uuid DEFAULT NULL::uuid, p_organization_id uuid DEFAULT NULL::uuid, p_actor_id uuid DEFAULT NULL::uuid, p_actor_role text DEFAULT NULL::text, p_actor_label text DEFAULT NULL::text)
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
$function$

;

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
$function$

;

CREATE OR REPLACE FUNCTION public.protect_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('club27.purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'audit log is append-only';
end;
$function$

;

CREATE OR REPLACE FUNCTION public.protect_final_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(current_setting('club27.purge', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if old.status in ('paid', 'void') then
    raise exception using errcode = 'IV002', message = 'Tagihan yang sudah lunas atau dibatalkan tidak bisa diubah';
  end if;
  return coalesce(new, old);
end;
$function$

;

CREATE OR REPLACE FUNCTION public.protect_posted_payroll()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(current_setting('club27.purge', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if old.status = 'posted' then
    raise exception using errcode = 'PR001', message = 'Gaji yang sudah dibukukan tidak bisa diubah';
  end if;
  return coalesce(new, old);
end;
$function$

;

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
    'order_counters:t', 'club_module_overrides:t', 'consents:to', 'audit_log:to', 'club_join_requests:t', 'club_members:t',
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
$function$

;

CREATE OR REPLACE FUNCTION public.username_reserved(p_username text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select p_username in ('admin', 'superadmin', 'support', 'root', 'system', 'club27');
$function$

;

drop trigger if exists orders_stamp_request on public.orders;
CREATE TRIGGER orders_stamp_request BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION stamp_client_request_id('club27.order_request');
drop trigger if exists order_payments_stamp_request on public.order_payments;
CREATE TRIGGER order_payments_stamp_request BEFORE INSERT ON public.order_payments FOR EACH ROW EXECUTE FUNCTION stamp_client_request_id('club27.payment_request');

update public.subscription_plans set name = '27 Club Plus' where code = 'plus';
update public.superadmins set email = 'superadmin@club27.test' where email = 'superadmin@ruzz.test';
