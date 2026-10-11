CREATE OR REPLACE FUNCTION public.enforce_billing_gate(p_org uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_trial date;
begin
  select status, trial_ends_at into v_status, v_trial
  from organization_subscriptions where organization_id = p_org;
  if v_status is null then
    return;
  end if;
  if not exists (select 1 from tenants where organization_id = p_org) then
    return;
  end if;
  if v_status = 'pending_verification' then
    raise exception using errcode = 'SW003',
      message = 'Email pendaftaran belum diverifikasi. Buka tautan verifikasi yang dikirim ke email pemilik.';
  elsif v_status = 'pending' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi belum diaktifkan. Hubungi admin platform 27 Club untuk mengaktifkannya.';
  elsif v_status in ('suspended', 'cancelled') then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sedang ditangguhkan atau dibatalkan. Hubungi admin platform 27 Club.';
  elsif v_status = 'trial' and v_trial < (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'SW003',
      message = 'Masa trial organisasi ini sudah berakhir. Hubungi admin platform 27 Club untuk memilih paket.';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_org_max_tenants()
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

  select count(*) into v_count from tenants where organization_id = new.organization_id;
  if v_count >= v_limit then
    raise exception using
      errcode = 'SW004',
      message = format('Batas %s klub untuk paket organisasi ini sudah tercapai. Hubungi admin platform 27 Club untuk upgrade paket.', v_limit);
  end if;

  return new;
end;
$function$
;
