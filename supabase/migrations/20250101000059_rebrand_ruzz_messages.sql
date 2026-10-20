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
      message = 'Langganan organisasi sedang ditangguhkan atau dibatalkan. Hubungi admin platform Ruzz.';
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
      message = format('Batas %s klub untuk paket organisasi ini sudah tercapai. Hubungi admin platform Ruzz untuk upgrade paket.', v_limit);
  end if;

  return new;
end;
$function$

;

