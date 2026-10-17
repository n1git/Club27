create function current_account_id() returns uuid as $$
  select a.id
  from accounts a
  where a.id = nullif(auth.jwt() ->> 'account_id', '')::uuid
    and a.is_active
    and (
      a.sessions_valid_after is null
      or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from a.sessions_valid_after))
    );
$$ language sql stable security definer set search_path = public;

revoke execute on function current_account_id() from public, anon;
grant execute on function current_account_id() to authenticated;

create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default current_account_id() references accounts(id) on delete cascade,
  sport text not null references club_types(code),
  performed_on date not null check (performed_on >= date '2000-01-01'),
  duration_min int not null check (duration_min between 1 and 1440),
  distance_m int check (distance_m between 1 and 1000000),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index workout_logs_account_idx on workout_logs (account_id, performed_on desc);

create function enforce_workout_log() returns trigger as $$
begin
  if new.performed_on > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'WL002', message = 'Tanggal latihan tidak boleh di masa depan';
  end if;
  if tg_op = 'INSERT' and (select count(*) from workout_logs where account_id = new.account_id) >= 10000 then
    raise exception using errcode = 'WL001', message = 'Batas 10.000 catatan latihan tercapai';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_workout_log() from public, anon, authenticated;

create trigger workout_logs_enforce before insert or update on workout_logs
  for each row execute function enforce_workout_log();

alter table workout_logs enable row level security;
revoke all on workout_logs from anon, authenticated;
grant select, insert, update, delete on workout_logs to authenticated;
create policy workout_logs_own on workout_logs for all to authenticated
  using (account_id = (select current_account_id()))
  with check (account_id = (select current_account_id()));

create table workout_goals (
  account_id uuid primary key default current_account_id() references accounts(id) on delete cascade,
  weekly_sessions int not null check (weekly_sessions between 1 and 21)
);

alter table workout_goals enable row level security;
revoke all on workout_goals from anon, authenticated;
grant select, insert, update, delete on workout_goals to authenticated;
create policy workout_goals_own on workout_goals for all to authenticated
  using (account_id = (select current_account_id()))
  with check (account_id = (select current_account_id()));
