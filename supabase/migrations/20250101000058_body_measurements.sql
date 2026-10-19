create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  measured_on date not null check (measured_on >= date '1900-01-01'),
  height_cm numeric(4,1) check (height_cm between 50 and 250),
  weight_kg numeric(4,1) check (weight_kg between 20 and 300),
  created_at timestamptz not null default now(),
  constraint body_measurements_value_present check (height_cm is not null or weight_kg is not null),
  constraint body_measurements_one_per_day unique (account_id, measured_on)
);

create function enforce_body_measurement() returns trigger as $$
begin
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

create trigger body_measurements_enforce before insert or update on body_measurements
  for each row execute function enforce_body_measurement();

alter table body_measurements enable row level security;
revoke all on body_measurements from anon, authenticated;
grant select, insert, update, delete on body_measurements to authenticated;
create policy body_measurements_own on body_measurements for all to authenticated
  using (account_id = (select current_account_id()))
  with check (account_id = (select current_account_id()));
