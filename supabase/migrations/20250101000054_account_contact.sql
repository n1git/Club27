alter table accounts
  add column phone text check (char_length(phone) <= 30),
  add column address text check (char_length(address) <= 500);

update accounts a
set phone = p.phone
from (
  select distinct on (account_id) account_id, phone
  from club_profiles
  where account_id is not null and phone is not null and phone <> ''
  order by account_id, created_at
) p
where p.account_id = a.id and a.phone is null;
