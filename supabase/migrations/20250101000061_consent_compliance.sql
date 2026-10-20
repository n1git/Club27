alter table consents drop constraint consents_kind_check;
alter table consents add constraint consents_kind_check
  check (kind in ('terms_privacy', 'member_data', 'guardian', 'health_data'));
alter table consents add column revoked_at timestamptz;

create index consents_account_kind_idx on consents (subject_id, kind) where subject_type = 'account';

create function guard_consents() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('club27.purge', true) = 'on' then
      update consents
      set club_id = null, organization_id = null, guardian_name = null, revoked_at = coalesce(revoked_at, now())
      where id = old.id;
      return null;
    end if;
    raise exception using errcode = 'CN001', message = 'Bukti persetujuan tidak boleh dihapus';
  end if;
  if (new.id, new.subject_type, new.subject_id, new.kind, new.version, new.recorded_by, new.accepted_at)
       is distinct from (old.id, old.subject_type, old.subject_id, old.kind, old.version, old.recorded_by, old.accepted_at)
     or (new.guardian_name is not null and new.guardian_name is distinct from old.guardian_name)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)
     or ((new.club_id is distinct from old.club_id or new.organization_id is distinct from old.organization_id)
         and current_setting('club27.purge', true) is distinct from 'on') then
    raise exception using errcode = 'CN002', message = 'Bukti persetujuan hanya bisa ditarik, tidak bisa diubah';
  end if;
  return new;
end;
$$ language plpgsql;

revoke execute on function guard_consents() from public, anon, authenticated;

create trigger consents_guard before update or delete on consents
  for each row execute function guard_consents();

create function has_health_consent(p_account uuid) returns boolean as $$
  select exists (
    select 1 from consents
    where subject_type = 'account' and subject_id = p_account and kind = 'health_data' and revoked_at is null
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function has_health_consent(uuid) from public, anon, authenticated;

create or replace function enforce_body_measurement() returns trigger as $$
begin
  if not has_health_consent(new.account_id) then
    raise exception using errcode = 'BM003', message = 'Setujui penyimpanan data kesehatan terlebih dahulu';
  end if;
  if new.measured_on > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'BM002', message = 'Tanggal pengukuran tidak boleh di masa depan';
  end if;
  if tg_op = 'INSERT' and (select count(*) from body_measurements where account_id = new.account_id) >= 10000 then
    raise exception using errcode = 'BM001', message = 'Batas 10.000 catatan kesehatan tercapai';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_body_measurement() from public, anon, authenticated;

create function withdraw_health_consent(p_account uuid) returns int as $$
declare
  v_deleted int;
begin
  update consents set revoked_at = now()
  where subject_type = 'account' and subject_id = p_account and kind = 'health_data' and revoked_at is null;
  delete from body_measurements where account_id = p_account;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function withdraw_health_consent(uuid) from public, anon, authenticated;
grant execute on function withdraw_health_consent(uuid) to service_role;

create function retention_candidates()
returns table(kind text, ref_id uuid, rows_count bigint, last_activity timestamptz) as $$
  select 'audit_log'::text, null::uuid, count(*), max(a.at)
  from audit_log a
  where a.at < now() - interval '5 years'
  having count(*) > 0
  union all
  select 'inactive_account'::text, ac.id, 1::bigint, coalesce(ac.last_login_at, ac.created_at)
  from accounts ac
  where coalesce(ac.last_login_at, ac.created_at) < now() - interval '3 years'
    and not exists (select 1 from club_profiles p where p.account_id = ac.id)
    and not exists (select 1 from organization_users o where o.account_id = ac.id);
$$ language sql stable security definer set search_path = public;

revoke execute on function retention_candidates() from public, anon, authenticated;
grant execute on function retention_candidates() to service_role;
