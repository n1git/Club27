create table club_join_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  account_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 200),
  date_of_birth date not null check (date_of_birth >= date '1900-01-01'),
  phone text check (char_length(phone) <= 30),
  message text check (char_length(message) <= 300),
  privacy_version text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  member_id uuid references club_members(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references club_profiles(id) on delete set null
);

create unique index club_join_requests_pending_idx on club_join_requests (club_id, account_id) where status = 'pending';
create index club_join_requests_club_idx on club_join_requests (club_id, status, created_at desc);
create index club_join_requests_account_idx on club_join_requests (account_id, created_at desc);
create index club_join_requests_member_idx on club_join_requests (member_id);
create index club_join_requests_decided_by_idx on club_join_requests (decided_by);

alter table club_join_requests enable row level security;
revoke all on club_join_requests from anon, authenticated;
grant select on club_join_requests to authenticated;
create policy club_join_requests_select on club_join_requests for select to authenticated
  using (
    account_id = (select current_account_id())
    or (club_id = (select current_club_id()) and has_permission('members.create'))
  );

create function request_club_join(
  p_code text,
  p_full_name text,
  p_dob date,
  p_phone text,
  p_message text,
  p_privacy_version text
) returns uuid as $$
declare
  me uuid := current_account_id();
  v_club uuid;
  v_org uuid;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_id uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  select c.id, c.organization_id into v_club, v_org
  from clubs c where c.slug = lower(btrim(p_code)) and c.is_active;
  if v_club is null then
    raise exception using errcode = 'JN001', message = 'Kode klub tidak ditemukan';
  end if;
  if not club_has_module(v_club, 'member_portal') or coalesce(subscription_phase(v_org), '') not in ('trial', 'active') then
    raise exception using errcode = 'JN002', message = 'Klub ini belum menerima pendaftaran anggota online';
  end if;
  if p_dob is null or p_dob < date '1900-01-01' or p_dob > v_today then
    raise exception using errcode = 'JN003', message = 'Tanggal lahir tidak valid';
  end if;
  if p_dob > (v_today - interval '18 years')::date then
    raise exception using errcode = 'JN003', message = 'Pendaftaran mandiri hanya untuk usia 18 tahun ke atas. Minta klub mendaftarkan anak Anda.';
  end if;
  if exists (select 1 from club_profiles where club_id = v_club and account_id = me) then
    raise exception using errcode = 'JN004', message = 'Anda sudah terdaftar di klub ini';
  end if;
  if exists (select 1 from club_join_requests where club_id = v_club and account_id = me and status = 'pending') then
    raise exception using errcode = 'JN005', message = 'Permintaan Anda masih menunggu persetujuan';
  end if;
  if (select count(*) from club_join_requests where account_id = me and status = 'pending') >= 5
     or (select count(*) from club_join_requests where club_id = v_club and status = 'pending') >= 200 then
    raise exception using errcode = 'JN006', message = 'Batas permintaan tertunda tercapai';
  end if;
  insert into club_join_requests (club_id, account_id, full_name, date_of_birth, phone, message, privacy_version)
  values (v_club, me, btrim(p_full_name), p_dob, nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_message, '')), ''), p_privacy_version)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function cancel_club_join(p_id uuid) returns void as $$
declare
  n int;
begin
  if current_account_id() is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update club_join_requests set status = 'cancelled', decided_at = now()
  where id = p_id and account_id = current_account_id() and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using errcode = 'JN001', message = 'Permintaan tidak ditemukan';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create function decide_club_join(p_id uuid, p_club uuid, p_actor uuid, p_approve boolean, p_coach uuid default null, p_member uuid default null)
returns uuid as $$
declare
  r club_join_requests%rowtype;
  v_member uuid;
begin
  select * into r from club_join_requests where id = p_id and club_id = p_club and status = 'pending' for update;
  if r.id is null then
    raise exception using errcode = 'JN001', message = 'Permintaan tidak ditemukan';
  end if;
  if not p_approve then
    update club_join_requests set status = 'rejected', decided_at = now(), decided_by = p_actor where id = r.id;
    perform log_audit('member.join_rejected', 'join_request', r.id, '{}'::jsonb, p_club, null, p_actor, 'staff');
    return null;
  end if;
  perform enforce_billing_gate((select organization_id from clubs where id = p_club));
  if p_member is null then
    if p_coach is null then
      raise exception using errcode = 'JN007', message = 'Pilih pelatih';
    end if;
    insert into club_members (club_id, full_name, date_of_birth, coach_id, contact_phone)
    values (p_club, r.full_name, r.date_of_birth, p_coach, r.phone)
    returning id into v_member;
    insert into consents (club_id, subject_type, subject_id, kind, version)
    values (p_club, 'member', v_member, 'member_data', r.privacy_version);
  else
    select id into v_member from club_members
    where id = p_member and club_id = p_club and profile_id is null and is_active for update;
    if v_member is null then
      raise exception using errcode = 'JN008', message = 'Anggota tidak ditemukan atau sudah punya akun';
    end if;
  end if;
  perform activate_member_account(v_member, r.account_id);
  update club_join_requests set status = 'approved', decided_at = now(), decided_by = p_actor, member_id = v_member where id = r.id;
  perform log_audit('member.join_approved', 'member', v_member, jsonb_build_object('request', r.id, 'linked_existing', p_member is not null), p_club, null, p_actor, 'staff');
  return v_member;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function request_club_join(text, text, date, text, text, text), cancel_club_join(uuid) from public, anon;
grant execute on function request_club_join(text, text, date, text, text, text), cancel_club_join(uuid) to authenticated;
revoke execute on function decide_club_join(uuid, uuid, uuid, boolean, uuid, uuid) from public, anon, authenticated;
grant execute on function decide_club_join(uuid, uuid, uuid, boolean, uuid, uuid) to service_role;

create or replace function purge_organization(p_org uuid, p_execute boolean default false) returns jsonb as $$
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
$$ language plpgsql security definer set search_path = public;
