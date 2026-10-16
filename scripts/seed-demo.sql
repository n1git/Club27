create function pg_temp.act(p_profile uuid, p_role text, p_tenant uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_profile, 'role', 'authenticated', 'app_role', p_role, 'tenant_id', p_tenant,
    'iat', extract(epoch from now())::bigint
  )::text, true)
$f$;

create function pg_temp.acct(p_email text, p_name text, p_hash text) returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  select id into v_id from accounts where email = lower(p_email);
  if v_id is null then
    insert into accounts (email, full_name, password_hash, email_verified_at)
    values (lower(p_email), p_name, p_hash, now()) returning id into v_id;
  end if;
  return v_id;
end
$f$;

create function pg_temp.clear() returns void language sql as $f$
  select set_config('request.jwt.claims', '', true)
$f$;

do $seed$
declare
  spec jsonb := $spec$__SPEC__$spec$::jsonb;
  firsts text[] := array['Budi','Siti','Agus','Dewi','Rizky','Putri','Andi','Sri','Eko','Rina','Fajar','Ayu','Hendra','Maya','Dimas','Nadia','Bayu','Citra','Wawan','Lestari','Yoga','Intan','Rendra','Salsabila','Galih','Anisa','Ilham','Wulan','Teguh','Melati','Arif','Kirana','Bagus','Laras','Joko','Fitri','Aditya','Permata','Satria','Ratna','Putu Éka','Ni Kadek Ayu','Komang Dwi','Made Ráhayu','Ketut Surya','I Wayan Dharma'];
  lasts text[] := array['Santoso','Wijaya','Pratama','Hartono','Kusuma','Saputra','Nugroho','Setiawan','Rahayu','Susanto','Hidayat','Gunawan','Wibowo','Purnama','Siregar','Nasution','Lubis','Simanjuntak','Sembiring','Tarigan','Ginting','Batubara','Harahap','Dalimunthe','Suryani','Maharani','Wardhana','Prasetyo','Kurniawan','Hakim','Sudarmā','Ráhayu'];
  o jsonb; c jsonb; s jsonb; ma jsonb;
  v_org uuid; v_owner uuid; v_tenant uuid; v_owner_profile uuid; v_pid uuid;
  v_first boolean; v_ci int; v_acct uuid; v_role uuid; v_paid boolean;
  v_admin uuid; v_finance uuid; v_recep uuid; v_head uuid;
  v_coaches uuid[]; v_loc uuid; v_loc2 uuid; v_ct uuid[]; v_pk_m uuid; v_pk_q uuid; v_pk_s uuid;
  v_n int; v_tid uuid;
  r record; v_i int; v_cnt int;
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date;
  v_prev_start date := (date_trunc('month', (now() at time zone 'Asia/Jakarta')) - interval '1 month')::date;
  v_prev_end date := (date_trunc('month', (now() at time zone 'Asia/Jakarta')) - interval '1 day')::date;
  v_cur_end date := (date_trunc('month', (now() at time zone 'Asia/Jakarta')) + interval '1 month - 1 day')::date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_orders uuid;
begin
  if exists (select 1 from organizations where name like (spec ->> 'prefix') || '%') then
    raise notice 'seed-demo: already seeded, nothing to do';
    return;
  end if;
  perform setseed(0.2718);

  for o in select * from jsonb_array_elements(spec -> 'orgs') loop
    v_first := true;
    v_ci := 0;
    for c in select * from jsonb_array_elements(o -> 'clubs') loop
      v_ci := v_ci + 1;
      if v_first then
        select organization_id, tenant_id, owner_id, profile_id into v_org, v_tenant, v_owner, v_owner_profile
        from register_organization(
          o ->> 'name', c ->> 'name', pg_temp.acct(o #>> '{owner,email}', o #>> '{owner,name}', o #>> '{owner,hash}'),
          o ->> 'plan', o ->> 'period', c ->> 'type');
        update organization_subscriptions set seats = 100 where organization_id = v_org;
        if o ->> 'status' = 'active' then
          perform set_organization_status(v_org, 'active', 'seed-demo', v_today, null);
        end if;
        v_first := false;
      else
        select tenant_id, profile_id into v_tenant, v_owner_profile
        from create_tenant_for_owner(v_owner, c ->> 'name', c ->> 'type');
      end if;
      update tenants set onboarding_completed_at = now() where id = v_tenant;

      if coalesce((o ->> 'staffless')::boolean, false) then
        continue;
      end if;

      v_coaches := '{}';
      v_head := null;
      for s in select * from jsonb_array_elements(c -> 'staff') loop
        v_acct := pg_temp.acct(s ->> 'email', s ->> 'name', s ->> 'hash');
        select id, is_paid into v_role, v_paid from organization_roles
        where organization_id = v_org and preset_key = case s ->> 'role'
          when 'admin' then 'admin'
          when 'receptionist' then 'resepsionis'
          when 'finance' then 'keuangan'
          else case when coalesce((s ->> 'head')::boolean, false) then 'kepala_pelatih' else 'pelatih' end
        end;
        if v_paid then
          insert into organization_members (organization_id, account_id, email, full_name, base_role)
          values (v_org, v_acct, s ->> 'email', s ->> 'name', 'staff')
          on conflict (organization_id, account_id) do nothing;
          insert into organization_member_clubs (member_id, tenant_id)
          select id, v_tenant from organization_members where organization_id = v_org and account_id = v_acct
          on conflict do nothing;
        end if;
        insert into profiles (tenant_id, account_id, role, org_role_id, full_name, email, phone)
        values (v_tenant, v_acct, 'staff', v_role, s ->> 'name', s ->> 'email', '08990000' || lpad((floor(random() * 10000))::int::text, 4, '0'))
        returning id into v_pid;
        if s ->> 'role' = 'admin' then v_admin := v_pid; end if;
        if s ->> 'role' = 'finance' then v_finance := v_pid; end if;
        if s ->> 'role' = 'receptionist' then v_recep := v_pid; end if;
        if s ->> 'role' = 'coach' then
          v_coaches := v_coaches || v_pid;
          if coalesce((s ->> 'head')::boolean, false) then v_head := v_pid; end if;
          insert into coach_certifications (tenant_id, coach_id, name, number, valid_until)
          values (v_tenant, v_pid, 'Sertifikasi Pelatih Level ' || (1 + floor(random() * 3))::int, 'CERT-' || substr(md5(v_pid::text), 1, 8),
                  v_today + (floor(random() * 400) - 40)::int);
          update profiles set specialization = 'Teknik dasar dan kebugaran', session_rate = 100000 + floor(random() * 8) * 25000 where id = v_pid;
        end if;
      end loop;

      insert into locations (tenant_id, name, address) values (v_tenant, 'Lokasi Utama', 'Jl. Merdeka No. 1, Jakarta') returning id into v_loc;
      insert into locations (tenant_id, name, address) values (v_tenant, 'Lokasi Cabang', 'Jl. Melati No. 8, Bandung') returning id into v_loc2;
      with ins as (
        insert into class_types (tenant_id, name, description) values
          (v_tenant, 'Kelas Pemula', 'Untuk anggota baru'),
          (v_tenant, 'Kelas Menengah', 'Untuk anggota berpengalaman'),
          (v_tenant, 'Kelas Prestasi', 'Persiapan kompetisi')
        returning id)
      select array_agg(id) into v_ct from ins;

      insert into membership_packages (tenant_id, name, price, billing_cycle, description)
      values (v_tenant, 'Bulanan Reguler', 450000, 'monthly', '8 pertemuan per bulan') returning id into v_pk_m;
      insert into membership_packages (tenant_id, name, price, billing_cycle, description)
      values (v_tenant, 'Triwulan Hemat', 1200000, 'quarterly', 'Bayar tiga bulan sekaligus') returning id into v_pk_q;
      insert into membership_packages (tenant_id, name, price, pricing_mode, sessions_included, validity_weeks, description)
      values (v_tenant, 'Paket 8 Sesi', 600000, 'session_pack', 8, 6, 'Bebas jadwal, berlaku 6 minggu') returning id into v_pk_s;

      v_n := (c ->> 'members')::int;
      insert into members (tenant_id, full_name, date_of_birth, coach_id, contact_name, contact_phone, notes, address, preferred_location_id, is_active)
      select v_tenant,
        case
          when g <= 3 then firsts[g] || ' ' || lasts[g]
          when g between 4 and 6 then firsts[g - 3] || ' ' || lasts[g - 3]
          when g = 7 then left(repeat('Nama Sangat Panjang ', 10), 199) || g
          else firsts[1 + floor(random() * array_length(firsts, 1))::int] || ' ' || lasts[1 + floor(random() * array_length(lasts, 1))::int]
        end,
        case when g % 3 = 0 then date '1985-01-01' + floor(random() * 6000)::int else date '2012-01-01' + floor(random() * 3000)::int end,
        v_coaches[1 + (g % array_length(v_coaches, 1))],
        case when g % 3 = 0 then null else 'Orang tua ' || lasts[1 + floor(random() * array_length(lasts, 1))::int] end,
        case when g % 3 = 0 then null else '08990000' || lpad((floor(random() * 10000))::int::text, 4, '0') end,
        case when g % 17 = 0 then 'Alergi klorin 🏊 perlu perhatian' when g % 11 = 0 then 'Catatan: prefer jadwal pagi' else null end,
        case when g % 5 = 0 then 'Jl. Anggrek No. ' || g || ', Jakarta' else null end,
        case when g % 2 = 0 then v_loc else v_loc2 end,
        g % 10 <> 0
      from generate_series(1, v_n) g;

      insert into promo (tenant_id, title, body, active_from, active_until, author_id) values
        (v_tenant, 'Promo Pendaftaran Baru', 'Diskon 20% untuk pendaftaran bulan ini.', now() - interval '3 days', now() + interval '20 days', v_owner_profile),
        (v_tenant, 'Promo Lama Berakhir', 'Promo yang sudah selesai.', now() - interval '60 days', now() - interval '30 days', v_owner_profile);

      if (c ->> 'load')::boolean is true then
        insert into subscriptions (tenant_id, member_id, package_id, start_date)
        select v_tenant, m.id, v_pk_m, v_prev_start
        from members m where m.tenant_id = v_tenant and m.is_active
        order by m.created_at, m.id
        limit (v_n * 6 / 10);
        perform generate_invoices_for_period(v_prev_start, v_prev_end, v_prev_start + 9, v_tenant);
        perform generate_invoices_for_period(v_month_start, v_cur_end, v_month_start + 9, v_tenant);
        with paid as (
          update invoices set status = 'paid', paid_at = now() - interval '2 days'
          where tenant_id = v_tenant and status = 'outstanding' and id::text < '5'
          returning id, amount)
        insert into cash_ledger (tenant_id, category, direction, amount, invoice_id, created_by)
        select v_tenant, 'payment_received', 'in', amount, id, v_admin from paid;

        insert into classes (tenant_id, instructor_id, location_id, class_type_id, start_time, end_time, capacity)
        select v_tenant, v_coaches[1 + k], v_loc, v_ct[1 + (d % 3)],
          ((v_today - d) + time '05:00' + make_interval(hours => k)) at time zone 'Asia/Jakarta',
          ((v_today - d) + time '05:55' + make_interval(hours => k)) at time zone 'Asia/Jakarta',
          60
        from generate_series(0, 39) d cross join generate_series(0, array_length(v_coaches, 1) - 1) k;

        select count(*) into v_cnt from members where tenant_id = v_tenant and is_active;
        with mm as (select id, row_number() over (order by id) - 1 as mi from members where tenant_id = v_tenant and is_active),
             cl as (select id, row_number() over (order by start_time, id) - 1 as ci from classes where tenant_id = v_tenant)
        insert into bookings (tenant_id, member_id, class_id)
        select v_tenant, mm.id, cl.id from cl join mm on (((mm.mi - cl.ci * 11) % v_cnt) + v_cnt) % v_cnt < 50;

        insert into checkin_points (tenant_id, location_id, name) values (v_tenant, v_loc, 'Pintu Depan'), (v_tenant, v_loc2, 'Pintu Cabang');
        insert into checkins (tenant_id, member_id, point_id, checked_in_at, method)
        select v_tenant, m.id, (select id from checkin_points where tenant_id = v_tenant order by name limit 1),
          now() - make_interval(mins => floor(random() * 129600)::int), 'qr'
        from (select id from members where tenant_id = v_tenant and is_active) m cross join generate_series(1, 12) g
        limit 50000;
        continue;
      end if;

      if (c ->> 'load')::boolean is not true then
        insert into subscriptions (tenant_id, member_id, package_id, start_date)
        select v_tenant, m.id,
          case when row_number() over (order by m.created_at, m.id) % 5 = 0 then v_pk_s
               when row_number() over (order by m.created_at, m.id) % 4 = 0 then v_pk_q
               else v_pk_m end,
          v_prev_start
        from members m where m.tenant_id = v_tenant and m.is_active and m.profile_id is null
        order by m.created_at, m.id
        limit (v_n * 7 / 10);

        perform pg_temp.clear();
        perform generate_invoices_for_period(v_prev_start, v_prev_end, v_prev_start + 9, v_tenant);
        perform generate_invoices_for_period(v_month_start, v_cur_end, v_month_start + 9, v_tenant);

        perform pg_temp.act(v_finance, 'finance', v_tenant);
        for r in select id from invoices where tenant_id = v_tenant and status = 'outstanding' and period_start = v_prev_start order by id limit (v_n / 4) loop
          perform mark_invoice_paid(r.id);
        end loop;
        for r in select id from invoices where tenant_id = v_tenant and status = 'outstanding' and period_start = v_month_start order by id limit (v_n / 4) loop
          perform mark_invoice_paid(r.id);
        end loop;
        perform pg_temp.clear();
        update invoices set status = 'void' where id in (
          select id from invoices where tenant_id = v_tenant and status = 'outstanding' and period_start = v_month_start order by id limit greatest(v_n / 20, 1));

        perform pg_temp.act(v_finance, 'finance', v_tenant);
        for r in select id, coalesce(session_rate, 150000) rate from instructors where tenant_id = v_tenant loop
          perform create_payroll_run(r.id, v_prev_start, v_prev_end, r.rate * 8, case when r.id = v_head then 250000 else 0 end, 0);
        end loop;
        perform pg_temp.clear();
        insert into cash_ledger (tenant_id, category, direction, amount, reason, created_by) values
          (v_tenant, 'manual_adjustment', 'out', 750000, 'Sewa lintasan dan lapangan minggu ini', v_admin),
          (v_tenant, 'manual_adjustment', 'in', 300000, 'Sponsor acara komunitas', v_admin),
          (v_tenant, 'manual_adjustment', 'out', 125000, 'Pembelian perlengkapan kebersihan', v_finance);
      end if;

      v_cnt := 0;
      for v_i in 1 .. array_length(v_coaches, 1) loop
        for r in select d from generate_series(-12, 14) d loop
          if (r.d + v_i) % 2 = 0 then
            insert into classes (tenant_id, instructor_id, location_id, class_type_id, start_time, end_time, capacity)
            values (v_tenant, v_coaches[v_i], case when (r.d + v_i) % 4 = 0 then v_loc else v_loc2 end, v_ct[1 + ((r.d + v_i + 30) % 3)],
              ((v_today + r.d) + time '06:00' + make_interval(hours => (v_i % 6) * 2)) at time zone 'Asia/Jakarta',
              ((v_today + r.d) + time '07:00' + make_interval(hours => (v_i % 6) * 2)) at time zone 'Asia/Jakarta',
              case when v_cnt = 0 then 3 else 12 end);
            v_cnt := v_cnt + 1;
          end if;
        end loop;
      end loop;

      insert into bookings (tenant_id, member_id, class_id)
      select cl.tenant_id, m.id, cl.id
      from classes cl
      join lateral (
        select mm.id from members mm
        where mm.tenant_id = cl.tenant_id and mm.is_active and mm.coach_id = cl.instructor_id
        order by mm.id limit least(6, cl.capacity) offset (extract(epoch from cl.start_time)::bigint / 86400 % 3)::int * 2
      ) m on true
      where cl.tenant_id = v_tenant;

      update bookings b set is_attended = true, attended_at = cl.start_time
      from classes cl where cl.id = b.class_id and b.tenant_id = v_tenant and cl.end_time < now() and b.id::text < '9';

      if array_length(v_coaches, 1) >= 2 then
        update classes set substitute_id = v_coaches[1]
        where id = (select id from classes where tenant_id = v_tenant and instructor_id = v_coaches[2] and start_time > now() order by start_time limit 1)
          and not exists (select 1 from classes x where x.tenant_id = v_tenant and x.id <> classes.id and coalesce(x.substitute_id, x.instructor_id) = v_coaches[1]
                          and tstzrange(x.start_time, x.end_time) && tstzrange(classes.start_time, classes.end_time));
      end if;

      if (c ->> 'load')::boolean is true then
        continue;
      end if;

      perform pg_temp.act(v_admin, 'admin', v_tenant);
      for r in select * from (values ('Lintasan A', 'lane', 1, 60, 50000), ('Lintasan B', 'lane', 4, 60, 30000)) t(n, k, cap, slot, price) loop
        begin
          perform create_resource(v_loc, r.n, r.k, r.cap, r.slot, r.price, 14, 6, time '06:00', time '21:00');
        exception when others then
          raise notice 'seed-demo: create_resource skipped (%): %', c ->> 'type', sqlerrm;
        end;
      end loop;
      perform pg_temp.clear();

      perform pg_temp.act(v_recep, 'receptionist', v_tenant);
      for r in select id, row_number() over (order by name) rn from resources where tenant_id = v_tenant loop
        for v_i in 1 .. 3 loop
          begin
            perform book_resource(r.id,
              ((v_today + v_i + r.rn::int) + time '08:00') at time zone 'Asia/Jakarta',
              ((v_today + v_i + r.rn::int) + time '09:00') at time zone 'Asia/Jakarta',
              (select id from members where tenant_id = v_tenant and is_active order by id offset v_i limit 1), null, null);
          exception when others then
            raise notice 'seed-demo: book_resource skipped: %', sqlerrm;
          end;
        end loop;
        begin
          perform book_resource(r.id,
            ((v_today + 9) + time '10:00') at time zone 'Asia/Jakarta',
            ((v_today + 9) + time '11:00') at time zone 'Asia/Jakarta',
            null, 'Tamu Walk-in ' || r.rn, '08990001234');
        exception when others then
          raise notice 'seed-demo: guest booking skipped: %', sqlerrm;
        end;
      end loop;
      perform pg_temp.clear();

      insert into products (tenant_id, name, sku, category, price, track_stock, stock_qty) values
        (v_tenant, 'Kacamata renang', 'KCM-01', 'Perlengkapan', 85000, true, 25),
        (v_tenant, 'Topi renang', 'TPI-01', 'Perlengkapan', 45000, true, 40),
        (v_tenant, 'Air mineral', 'AIR-01', 'Minuman', 5000, true, 200),
        (v_tenant, 'Handuk klub', 'HDK-01', 'Perlengkapan', 120000, true, 3),
        (v_tenant, 'Sewa loker harian', 'LKR-01', 'Layanan', 10000, false, 0),
        (v_tenant, 'Produk nonaktif', 'OLD-01', 'Lainnya', 1000, false, 0);
      update products set is_active = false where tenant_id = v_tenant and sku = 'OLD-01';

      perform pg_temp.act(v_recep, 'receptionist', v_tenant);
      select id into v_orders from products where tenant_id = v_tenant and sku = 'KCM-01';
      begin
        perform create_order(null, 'Pelanggan Umum',
          jsonb_build_array(jsonb_build_object('kind', 'product', 'product_id', v_orders, 'qty', 2)),
          jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 170000)));
        perform create_order((select id from members where tenant_id = v_tenant and is_active order by id limit 1), null,
          jsonb_build_array(jsonb_build_object('kind', 'product', 'product_id', (select id from products where tenant_id = v_tenant and sku = 'TPI-01'), 'qty', 1),
                            jsonb_build_object('kind', 'product', 'product_id', (select id from products where tenant_id = v_tenant and sku = 'AIR-01'), 'qty', 3)),
          jsonb_build_array(jsonb_build_object('method', 'qris', 'amount', 30000)));
        v_orders := create_order(null, 'Pesanan Belum Lunas',
          jsonb_build_array(jsonb_build_object('kind', 'product', 'product_id', (select id from products where tenant_id = v_tenant and sku = 'HDK-01'), 'qty', 1)),
          '[]'::jsonb);
        perform add_order_payment(v_orders, 'transfer', 50000, 'TRX-DEMO-1');
        v_orders := create_order(null, 'Pesanan Dibatalkan',
          jsonb_build_array(jsonb_build_object('kind', 'product', 'product_id', (select id from products where tenant_id = v_tenant and sku = 'AIR-01'), 'qty', 2)),
          jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10000)));
        perform void_order(v_orders, 'Salah input jumlah barang');
      exception when others then
        raise notice 'seed-demo: orders skipped (%): %', c ->> 'type', sqlerrm;
      end;
      perform pg_temp.clear();

      if exists (select 1 from club_type_modules where club_type = c ->> 'type' and module_code = 'checkin') then
        insert into checkin_points (tenant_id, location_id, name) values (v_tenant, v_loc, 'Pintu Depan'), (v_tenant, v_loc2, 'Pintu Cabang');
        insert into checkins (tenant_id, member_id, point_id, checked_in_at, method, subscription_id)
        select v_tenant, s.member_id, (select id from checkin_points where tenant_id = v_tenant order by name limit 1),
               now() - make_interval(hours => (g * 7) % 700), 'qr', s.id
        from subscriptions s join generate_series(1, 3) g on true
        where s.tenant_id = v_tenant and s.status = 'active'
        order by s.id limit (v_n * 2);
      end if;

      for ma in select * from jsonb_array_elements(coalesce(c -> 'memberAccounts', '[]'::jsonb)) loop
        begin
          perform activate_member_account(
            (select id from members where tenant_id = v_tenant and is_active and profile_id is null order by created_at, id offset (ma ->> 'idx')::int limit 1),
            pg_temp.acct(ma ->> 'email', 'Anggota Demo', ma ->> 'hash'));
        exception when others then
          raise notice 'seed-demo: member account skipped (%): %', ma ->> 'email', sqlerrm;
        end;
      end loop;
    end loop;

    if o ->> 'finalize' = 'trial-expired' then
      update organization_subscriptions set trial_ends_at = v_today - 5 where organization_id = v_org;
    elsif o ->> 'finalize' = 'suspended' then
      perform set_organization_status(v_org, 'suspended', 'seed-demo');
    end if;
  end loop;
end
$seed$;
