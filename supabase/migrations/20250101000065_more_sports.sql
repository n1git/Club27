insert into club_types (code, name, status, sort_order, terms) values
  ('futsal', 'Klub Futsal', 'ready', 7, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Lapangan","session":"Sesi","location":"Lokasi Lapangan"}'),
  ('badminton', 'Klub Badminton', 'ready', 8, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Lapangan","session":"Sesi","location":"Lokasi Lapangan"}'),
  ('mini_soccer', 'Klub Mini Soccer', 'ready', 9, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Lapangan","session":"Sesi","location":"Lokasi Lapangan"}'),
  ('basketball', 'Klub Basket', 'ready', 10, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Lapangan","session":"Sesi","location":"Lokasi Lapangan"}'),
  ('volleyball', 'Klub Voli', 'ready', 11, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Lapangan","session":"Sesi","location":"Lokasi Lapangan"}'),
  ('pickleball', 'Klub Pickleball', 'ready', 12, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Lapangan","session":"Sesi","location":"Lokasi Lapangan"}'),
  ('table_tennis', 'Klub Tenis Meja', 'ready', 13, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Meja","session":"Sesi","location":"Lokasi Meja"}'),
  ('crossfit', 'CrossFit', 'ready', 14, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Box","session":"Sesi","location":"Lokasi Box"}'),
  ('martial_arts', 'Bela Diri', 'ready', 15, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Area Latihan","session":"Sesi","location":"Lokasi Latihan"}'),
  ('dance', 'Studio Dance', 'ready', 16, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Studio","session":"Sesi","location":"Lokasi Studio"}'),
  ('running', 'Komunitas Lari', 'ready', 17, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","session":"Sesi Latihan","location":"Titik Kumpul"}'),
  ('other', 'Lainnya', 'ready', 18, '{"member":"Anggota","coach":"Pelatih","visit":"Kunjungan","resource":"Fasilitas","session":"Sesi","location":"Lokasi"}')
on conflict (code) do update set
  name = excluded.name,
  status = excluded.status,
  sort_order = excluded.sort_order,
  terms = excluded.terms;

delete from club_type_modules
where club_type in ('futsal', 'badminton', 'mini_soccer', 'basketball', 'volleyball', 'pickleball', 'table_tennis',
                    'crossfit', 'martial_arts', 'dance', 'running', 'other');

with m as (
  select array['members', 'plans', 'billing', 'cash_ledger', 'payroll', 'promo', 'member_portal'] as core
),
sets(code, mods) as (
  select 'futsal', core || array['resource_booking', 'pos', 'classes'] from m
  union all select 'badminton', core || array['resource_booking', 'pos', 'classes'] from m
  union all select 'mini_soccer', core || array['resource_booking', 'pos'] from m
  union all select 'basketball', core || array['resource_booking', 'pos', 'classes'] from m
  union all select 'volleyball', core || array['resource_booking', 'pos', 'classes'] from m
  union all select 'pickleball', core || array['resource_booking', 'pos'] from m
  union all select 'table_tennis', core || array['resource_booking', 'pos'] from m
  union all select 'crossfit', core || array['classes', 'checkin', 'resource_booking', 'pos'] from m
  union all select 'martial_arts', core || array['classes', 'resource_booking', 'pos'] from m
  union all select 'dance', core || array['classes', 'resource_booking', 'pos'] from m
  union all select 'running', core || array['classes'] from m
  union all select 'other', core || array['classes', 'resource_booking', 'pos'] from m
)
insert into club_type_modules (club_type, module_code)
select code, unnest(mods) from sets;

delete from club_type_presets
where club_type in ('futsal', 'badminton', 'mini_soccer', 'basketball', 'volleyball', 'pickleball', 'table_tennis',
                    'crossfit', 'martial_arts', 'dance', 'running', 'other');

insert into club_type_presets (club_type, kind, name_pattern, default_count, slot_minutes, default_capacity, sort_order) values
  ('futsal', 'court', 'Lapangan Futsal {n}', 1, 60, 1, 1),
  ('badminton', 'court', 'Lapangan Badminton {n}', 4, 60, 1, 1),
  ('mini_soccer', 'court', 'Lapangan Mini Soccer {n}', 1, 60, 1, 1),
  ('basketball', 'court', 'Lapangan Basket {n}', 1, 60, 1, 1),
  ('volleyball', 'court', 'Lapangan Voli {n}', 1, 60, 1, 1),
  ('pickleball', 'court', 'Lapangan Pickleball {n}', 2, 60, 1, 1),
  ('table_tennis', 'court', 'Meja {n}', 4, 60, 1, 1),
  ('crossfit', 'studio', 'Box {n}', 1, 60, 15, 1),
  ('martial_arts', 'studio', 'Area Latihan {n}', 1, 60, 20, 1),
  ('dance', 'studio', 'Studio {n}', 1, 60, 20, 1),
  ('other', 'other', 'Fasilitas {n}', 1, 60, 1, 1);
