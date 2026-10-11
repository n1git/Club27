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
  if not is_admin() then
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
  if p_late_attendance and not is_admin() then
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
  if coalesce(current_setting('club27.late_attendance', true), '') = 'on' and is_admin() then
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

CREATE OR REPLACE FUNCTION public.log_audit(p_action text, p_target_type text DEFAULT NULL::text, p_target_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT '{}'::jsonb, p_tenant_id uuid DEFAULT NULL::uuid, p_organization_id uuid DEFAULT NULL::uuid, p_actor_id uuid DEFAULT NULL::uuid, p_actor_role text DEFAULT NULL::text, p_actor_label text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tenant uuid := coalesce(p_tenant_id, current_tenant_id());
begin
  if coalesce(current_setting('club27.audit_suppress', true), '') = 'on' then
    return;
  end if;
  insert into audit_log (actor_id, actor_role, actor_label, tenant_id, organization_id, action, target_type, target_id, details)
  values (
    coalesce(p_actor_id, auth.uid()),
    coalesce(p_actor_role, nullif(auth.jwt() ->> 'app_role', '')),
    p_actor_label,
    v_tenant,
    coalesce(p_organization_id, (select organization_id from tenants where id = v_tenant)),
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
  if exists (select 1 from bookings where class_id = old.id and is_attended) then
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
