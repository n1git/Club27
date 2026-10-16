begin;

drop function accept_invitation(text, uuid);
drop function create_invitation(uuid, uuid, text, uuid, text, text, text, uuid);
drop function transfer_ownership(uuid, uuid, uuid);
drop function consume_password_reset(text, text);
drop table invitations;
drop table password_resets;

create or replace function create_tenant_for_owner(p_owner_id uuid, p_tenant_name text, p_club_type text default 'swimming')
returns table (tenant_id uuid, profile_id uuid) as $$
declare
  v_owner organization_members%rowtype;
  v_tenant uuid;
  v_profile uuid;
begin
  select * into v_owner from organization_members where id = p_owner_id and is_active and base_role in ('p_owner', 'owner');
  if v_owner.id is null or v_owner.account_id is null then
    raise exception 'owner not found';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id, account_id)
  values (v_tenant, 'owner', v_owner.full_name, v_owner.email, v_owner.id, v_owner.account_id) returning id into v_profile;

  return query select v_tenant, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

commit;
